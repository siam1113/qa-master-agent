import { EventEmitter } from 'node:events';
import { randomUUID as uuid } from 'node:crypto';
import { env } from '../config/env.js';
import { agentRegistry } from './agentRegistry.js';
import { toolRegistry } from './toolRegistry.js';

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
    const performedActions = [];
    let finalUrl = targetUrl;
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 820 }, ignoreHTTPSErrors: true, recordVideo: process.env.RECORD_VIDEO_DIR ? { dir: process.env.RECORD_VIDEO_DIR } : undefined });
      const page = await context.newPage();
      this.emit('session', { type: 'browser.action', sessionId, message: `Navigating to ${targetUrl}` });
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await this.capturePageEvidence({ page, browserName, command, sessionId, screenshots, domSnapshots, observations, label: 'initial load' });

      const maxSteps = Math.max(2, Number(process.env.EXECUTION_MAX_STEPS || 5));
      for (let step = 1; step <= maxSteps; step += 1) {
        const action = await this.performNextBrowserAction({ page, command, step });
        if (!action) break;
        performedActions.push(action);
        this.emit('session', { type: 'browser.action', sessionId, message: `${step}. ${action.message}` });
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(350);
        await this.capturePageEvidence({ page, browserName, command, sessionId, screenshots, domSnapshots, observations, label: `after ${action.message}` });
      }

      finalUrl = page.url();
      if (!performedActions.length) failures.push('no_safe_follow_up_actions_detected');
      observations.push({ category: 'browser', message: `Executed ${performedActions.length} browser action(s) after loading ${finalUrl}.`, metadata: { performedActions } });
      await context.close();
      return { result: `Browser execution completed against ${finalUrl}; captured ${screenshots.length} frame(s), ${domSnapshots.length} DOM snapshot(s), and performed ${performedActions.length} action(s).`, observations, screenshots, domSnapshots, failures };
    } catch (error) {
      failures.push(error.message);
      observations.push({ category: 'failure', message: `Browser execution failed: ${error.message}` });
      return { result: `Browser execution failed for ${finalUrl}: ${error.message}`, observations, screenshots, domSnapshots, failures };
    } finally {
      await browser.close();
    }
  }

  async capturePageEvidence({ page, browserName, command, sessionId, screenshots, domSnapshots, observations, label }) {
    const title = await page.title().catch(() => 'untitled');
    const url = page.url();
    const accessibility = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    const domSummary = await page.evaluate(() => Array.from(document.querySelectorAll('a,button,input,select,textarea,[role]')).slice(0, 120).map((el, index) => ({
      index,
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role'),
      text: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || '').trim().slice(0, 120),
      type: el.getAttribute('type'),
      href: el.getAttribute('href')
    }))).catch(() => []);
    const domResult = await toolRegistry.execute('dom.extract', { note: JSON.stringify(domSummary) }, { sessionId, scope: 'browser' });
    const screenshotBuffer = await page.screenshot({ fullPage: true, type: 'png' });
    const frame = { id: uuid(), timestamp: new Date().toISOString(), src: `data:image/png;base64,${screenshotBuffer.toString('base64')}`, label: `${browserName} frame (${label}): ${title || url}`, url, title, stepLabel: label };
    screenshots.push(frame);
    this.emit('session', { type: 'browser.frame', sessionId, frame });
    domSnapshots.push({ id: uuid(), timestamp: new Date().toISOString(), url, title, interactiveElements: domSummary });
    observations.push({ category: 'browser', message: `Captured ${label} at ${url} with title "${title || 'untitled'}".`, metadata: { browserName } });
    observations.push({ category: 'perception', message: `Extracted ${domResult.regions.length} interactive DOM region(s) for command: ${command}.`, metadata: { regions: domResult.regions, visibleTextChars: accessibility.length } });
    this.emit('session', { type: 'browser.dom', sessionId, message: `Detected ${domResult.regions.length} interactive regions at ${url}.`, regions: domResult.regions });
    return domSummary;
  }

  async performNextBrowserAction({ page, command, step }) {
    const fillLocator = page.locator('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea').filter({ hasNotText: /^$/ }).first();
    if (step === 1 && await fillLocator.count().catch(() => 0)) {
      const value = /email|login|sign in/i.test(command) ? 'qa@example.com' : 'QA automation note';
      await fillLocator.fill(value, { timeout: 2500 });
      return { kind: 'fill', message: `Filled first available field with ${value}` };
    }

    const candidates = page.locator('button:visible, [role="button"]:visible, a:visible, input[type="submit"]:visible');
    const count = Math.min(await candidates.count().catch(() => 0), 20);
    for (let index = step - 1; index < count; index += 1) {
      const candidate = candidates.nth(index);
      const text = ((await candidate.innerText({ timeout: 1000 }).catch(() => '')) || (await candidate.getAttribute('aria-label').catch(() => '')) || (await candidate.getAttribute('value').catch(() => '')) || '').trim();
      if (/delete|remove|logout|sign out|cancel|reset|danger/i.test(text)) continue;
      await candidate.click({ timeout: 3000 }).catch(async () => candidate.press('Enter', { timeout: 1000 }));
      return { kind: 'click', message: `Activated ${text || `interactive element ${index + 1}`}` };
    }
    return null;
  }
}
