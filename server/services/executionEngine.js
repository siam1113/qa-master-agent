import { EventEmitter } from 'node:events';
import { randomUUID as uuid } from 'node:crypto';
import { agentRegistry } from './agentRegistry.js';
import { toolRegistry } from './toolRegistry.js';
import { env } from '../config/env.js';

async function loadPlaywright() {
  return import('playwright');
}

export class ExecutionEngine extends EventEmitter {
  constructor({ graph }) {
    super();
    this.graph = graph;
  }

  async run({ command, agentId = 'agent-exploratory-qa', targetUrl = env.executionBaseUrl, browserName = 'chromium' }) {
    const agent = agentRegistry.get(agentId);
    const { session } = this.graph.startExecutionSession({ command, agent, targetUrl });
    this.emit('session', { type: 'session.started', sessionId: session.id, session });
    for (const log of session.logs) this.emit('session', { type: 'session.log', sessionId: session.id, log });

    const registeredTools = await toolRegistry.execute('mcp.registry.describe', {}, { sessionId: session.id, scope: 'browser' });
    const toolLog = this.graph.appendSessionLog(session.id, 'mcp', `Registered ${registeredTools.tools.length} scoped browser tool(s).`, { tools: registeredTools.tools.map((tool) => tool.name) });
    this.emit('session', { type: 'session.log', sessionId: session.id, log: toolLog });

    if (session.status === 'blocked_needs_clarification') {
      const result = this.graph.completeExecutionSession(session.id, { result: 'Execution blocked before browser launch because the operational command needs a clearer workflow target.', failures: session.failures });
      this.emit('session', { type: 'session.completed', sessionId: session.id, session: result.action.session });
      return result;
    }

    if (!targetUrl) {
      const log = this.graph.appendSessionLog(session.id, 'configuration', 'No target URL configured. Set EXECUTION_BASE_URL or submit targetUrl to run real browser execution.');
      this.emit('session', { type: 'session.log', sessionId: session.id, log });
      const result = this.graph.completeExecutionSession(session.id, { result: 'Execution could not launch because no target application URL was configured.', failures: ['missing_target_url'] });
      this.emit('session', { type: 'session.completed', sessionId: session.id, session: result.action.session });
      return result;
    }

    const browserEvidence = await this.executeBrowserSession({ sessionId: session.id, targetUrl, browserName, command });
    const result = this.graph.completeExecutionSession(session.id, browserEvidence);
    this.emit('session', { type: 'session.completed', sessionId: session.id, session: result.action.session });
    return result;
  }

  async executeBrowserSession({ sessionId, targetUrl, browserName, command }) {
    const playwright = await loadPlaywright();
    const launcher = playwright[browserName] || playwright.chromium;
    const browser = await launcher.launch({ headless: env.browserHeadless });
    const observations = [];
    const screenshots = [];
    const domSnapshots = [];
    const failures = [];
    try {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors: true, recordVideo: process.env.RECORD_VIDEO_DIR ? { dir: process.env.RECORD_VIDEO_DIR } : undefined });
      const page = await context.newPage();
      this.emit('session', { type: 'browser.action', sessionId, message: `Navigating to ${targetUrl}` });
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      const title = await page.title();
      const url = page.url();
      const accessibility = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
      const domSummary = await page.evaluate(() => Array.from(document.querySelectorAll('a,button,input,select,textarea,[role]')).slice(0, 80).map((el) => ({ tag: el.tagName.toLowerCase(), role: el.getAttribute('role'), text: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || '').trim().slice(0, 120), type: el.getAttribute('type'), href: el.getAttribute('href') })));
      const domResult = await toolRegistry.execute('dom.extract', { note: JSON.stringify(domSummary) }, { sessionId, scope: 'browser' });
      const screenshotBuffer = await page.screenshot({ fullPage: true, type: 'png' });
      const dataUrl = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
      screenshots.push({ id: uuid(), timestamp: new Date().toISOString(), src: dataUrl, label: `${browserName} frame: ${title || url}` });
      domSnapshots.push({ id: uuid(), timestamp: new Date().toISOString(), url, title, interactiveElements: domSummary });
      observations.push({ category: 'browser', message: `Loaded ${url} with title "${title || 'untitled'}".`, metadata: { browserName } });
      observations.push({ category: 'perception', message: `Extracted ${domResult.regions.length} interactive DOM region(s) for command: ${command}.`, metadata: { regions: domResult.regions, visibleTextChars: accessibility.length } });
      if (!domSummary.length) failures.push('no_interactive_elements_detected');
      await context.close();
      return { result: `Browser execution completed against ${url}; captured screenshot, DOM snapshot, and ${domSummary.length} interactive element(s).`, observations, screenshots, domSnapshots, failures };
    } catch (error) {
      failures.push(error.message);
      observations.push({ category: 'failure', message: `Browser execution failed: ${error.message}` });
      return { result: `Browser execution failed for ${targetUrl}: ${error.message}`, observations, screenshots, domSnapshots, failures };
    } finally {
      await browser.close();
    }
  }
}
