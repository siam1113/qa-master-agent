import { randomUUID as uuid, createHash } from 'node:crypto';
import { fixtureDocuments, fixtureImages, fixtureBusinessRules, fixtureWorkflows } from '../data/fixtureContent.js';
import { vectorPipeline } from './vectorPipeline.js';
import { observability } from './observability.js';
import { llmProvider } from './llmProvider.js';

export class KnowledgeGraphService {
  constructor() {
    this.nodes = new Map();
    this.edges = [];
    this.logs = [];
    this.memoryInsights = [];
    this.memoryVersions = [];
    this.sessions = new Map();
    this.executionHistory = [];
    this.seeded = false;
    this.onPersist = null;
  }

  hydrate(state = {}) {
    this.nodes = new Map((state.nodes || []).map((node) => [node.id, node]));
    this.edges = state.edges || [];
    this.logs = state.logs || [];
    this.memoryInsights = state.memoryInsights || [];
    this.memoryVersions = state.memoryVersions || [];
    this.sessions = new Map((state.sessions || []).map((session) => [session.id, session]));
    this.executionHistory = [...this.sessions.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return this.getState();
  }

  seedFixtures() {
    if (this.seeded) return this.getState();
    this.log('system', 'Loading explicit fixture knowledge package for local tests or opted-in development bootstrapping.');
    fixtureDocuments.forEach((document) => this.ingestDocument(document, { fixture: true, sourceType: 'onboarding_document' }));
    fixtureImages.forEach((image) => this.ingestImage(image, { fixture: true }));
    fixtureWorkflows.forEach((workflow) => this.ingestWorkflow(workflow, { fixture: true }));
    fixtureBusinessRules.forEach((rule) => this.ingestRule(rule, { fixture: true }));
    this.createMemoryVersion('fixture-import', 'Initial memory created from explicitly enabled fixture package.', ['fixture:onboarding']);
    this.seeded = true;
    return this.getState();
  }

  seed() {
    return this.seedFixtures();
  }

  upsertNode(node) {
    const existing = this.nodes.get(node.id) || {};
    const merged = { confidence: 0.72, tags: [], createdAt: existing.createdAt || new Date().toISOString(), ...existing, ...node, updatedAt: new Date().toISOString() };
    this.nodes.set(node.id, merged);
    return merged;
  }

  addEdge(source, target, relationship, properties = {}) {
    const exists = this.edges.some((edge) => edge.source === source && edge.target === target && edge.relationship === relationship);
    if (!exists) this.edges.push({ id: uuid(), source, target, relationship, confidence: properties.confidence || 0.76, createdAt: new Date().toISOString(), ...properties });
  }

  ingestDocument(document, options = {}) {
    const documentId = document.id || `doc-${uuid()}`;
    const chunks = vectorPipeline.chunkKnowledge(document.content || '');
    this.upsertNode({ id: documentId, label: document.title || 'Untitled document', type: 'Document', content: document.content || '', source: options.fixture ? 'fixture' : 'ingested', sourceType: options.sourceType || 'document', tags: ['semantic-memory'], embedding: vectorPipeline.embed(`${document.title || ''} ${document.content || ''}`) });

    chunks.forEach((chunk, index) => {
      const chunkId = `${documentId}:chunk:${index + 1}`;
      this.upsertNode({ id: chunkId, label: `${document.title || 'Document'} chunk ${index + 1}`, type: 'KnowledgeChunk', content: chunk, source: documentId, embedding: vectorPipeline.embed(chunk), tags: ['rag'] });
      this.addEdge(documentId, chunkId, 'chunked_into');
    });

    const features = document.features?.length ? document.features : this.extractFeatures(document.content || '');
    features.forEach((feature) => {
      const featureId = this.slugNode('feature', feature);
      const actionId = this.slugNode('action', `Explore ${feature}`);
      this.upsertNode({ id: featureId, label: feature, type: 'Feature', content: `Capability: ${feature}`, tags: ['semantic-memory'] });
      this.upsertNode({ id: actionId, label: `Explore ${feature}`, type: 'Action', content: `Run exploratory checks for ${feature}.`, tags: ['execution-memory'] });
      this.addEdge(documentId, featureId, 'mentions');
      this.addEdge(featureId, actionId, 'validated_by');
    });

    (document.relatedScreens || []).forEach((screenId) => this.addEdge(documentId, screenId, 'references_screen'));
    this.log('ingest', `Processed document "${document.title || documentId}" into ${chunks.length} RAG chunk(s) and ${features.length} feature node(s).`);
    this.addInsight(`Memory expanded with document "${document.title || documentId}".`, ['semantic', 'rag']);
    if (!options.fixture) this.createMemoryVersion('ingestion', `Ingested ${document.title || documentId}.`, [documentId]);
    return this.getState();
  }

  ingestImage(image, options = {}) {
    const imageId = image.id || `screen-${uuid()}`;
    const content = image.summary || image.alt || 'UI capture';
    this.upsertNode({ id: imageId, label: image.title || 'Untitled UI image', type: 'Screen', content, src: image.src, source: options.fixture ? 'fixture' : 'ingested', tags: ['perception-memory'], mindmap: image.mindmap || null, embedding: vectorPipeline.embed(`${image.title || ''} ${content}`) });
    (image.features || []).forEach((feature) => {
      const featureId = this.slugNode('feature', feature);
      this.upsertNode({ id: featureId, label: feature, type: 'Feature', content: `Capability: ${feature}` });
      this.addEdge(featureId, imageId, 'shown_on');
    });
    this.log('ingest', `Processed UI capture "${image.title || imageId}" and linked visual entities.`);
    this.addInsight(`Visual memory added for "${image.title || imageId}".`, ['perception']);
    return this.getState();
  }

  ingestWorkflow(workflow, options = {}) {
    const workflowId = workflow.id || this.slugNode('workflow', workflow.name);
    this.upsertNode({ id: workflowId, label: workflow.name, type: 'Workflow', content: workflow.goal, source: options.fixture ? 'fixture' : 'ingested', tags: ['workflow'] });
    workflow.steps.forEach((step, index) => {
      const stepId = `${workflowId}:step:${index + 1}`;
      this.upsertNode({ id: stepId, label: step, type: 'WorkflowStep', content: `${workflow.name}: ${step}`, tags: ['workflow'] });
      this.addEdge(workflowId, stepId, 'contains_step', { order: index + 1 });
      if (index > 0) this.addEdge(`${workflowId}:step:${index}`, stepId, 'next_step');
    });
    (workflow.screens || []).forEach((screenId) => this.addEdge(workflowId, screenId, 'uses_screen'));
    (workflow.rules || []).forEach((ruleId) => this.addEdge(workflowId, ruleId, 'governed_by'));
    this.log('ingest', `Mapped workflow "${workflow.name}" with ${workflow.steps.length} step(s).`);
    return this.getState();
  }

  ingestRule(rule, options = {}) {
    const ruleId = rule.id || this.slugNode('rule', rule.name);
    this.upsertNode({ id: ruleId, label: rule.name, type: 'BusinessRule', content: rule.description, source: options.fixture ? 'fixture' : 'ingested', confidence: rule.confidence || 0.8, tags: ['business-rule'] });
    (rule.validations || []).forEach((validation) => {
      const validationId = this.slugNode('validation', validation);
      this.upsertNode({ id: validationId, label: validation, type: 'Validation', content: validation, tags: ['validation'] });
      this.addEdge(ruleId, validationId, 'requires_validation');
    });
    this.log('ingest', `Added business rule "${rule.name}" with validation coverage.`);
    return this.getState();
  }

  async enhanceKnowledge({ title, content = '', imageAlt = '', imageSrc = '', businessRule }) {
    const hasImage = Boolean(imageSrc?.trim() || imageAlt?.trim());
    const imageAnalysis = hasImage ? await this.analyzeImageCapture({ title, imageAlt, imageSrc, context: content }) : null;
    const documentContent = [content, imageAnalysis?.documentText].filter(Boolean).join('\n\n');
    const features = [...new Set([
      ...this.extractFeatures(documentContent || imageAlt || title),
      ...(imageAnalysis?.features || [])
    ])].slice(0, 8);

    this.ingestDocument({ title, content: documentContent || `Visual onboarding memory for ${title}.`, features }, { sourceType: hasImage ? 'visual_onboarding' : 'document' });
    if (hasImage) this.ingestImage({ title: `${title} UI mindmap`, alt: imageAlt || imageAnalysis?.summary || 'Pasted UI capture', src: imageSrc, features, summary: imageAnalysis?.summary, mindmap: imageAnalysis?.mindmap });
    if (businessRule?.trim()) this.ingestRule({ name: `${title} rule`, description: businessRule, validations: this.extractFeatures(businessRule), confidence: 0.66 });
    this.log('enhance', `Enhance pipeline parsed "${title}", generated readable memory nodes, and refreshed graph lineage.`, { visualParsing: hasImage, llmProvider: imageAnalysis?.provider });
    return this.getState();
  }

  async analyzeImageCapture({ title, imageAlt = '', imageSrc = '', context = '' }) {
    const fallback = this.buildImageMindmap({ title, imageAlt, context });
    if (!this.isLikelyImageDataUrl(imageSrc)) return fallback;

    const system = 'You turn UI screenshots into user-readable QA memory. Return strict JSON only.';
    const prompt = `Analyze this pasted application screenshot for QA onboarding. Context: ${context || 'none'}. User notes: ${imageAlt || 'none'}. Return JSON with keys summary, features, and mindmap. mindmap must have label, description, and children arrays. Keep it concise and readable.`;
    let llm;
    try {
      llm = await llmProvider.completeVision({ system, prompt, imageSrc, metadata: { feature: 'image-ingestion', title } });
    } catch (error) {
      this.log('llm.vision.fallback', `Image parsing fell back to notes because LLM vision failed: ${error.message}`);
      return fallback;
    }
    if (!llm.content) return { ...fallback, provider: llm.provider };

    const parsed = this.parseJsonObject(llm.content);
    if (!parsed) return { ...fallback, provider: llm.provider };
    const mindmap = parsed.mindmap?.label ? parsed.mindmap : fallback.mindmap;
    const summary = parsed.summary || fallback.summary;
    const features = Array.isArray(parsed.features) ? parsed.features.filter(Boolean).slice(0, 8) : fallback.features;
    return { provider: llm.provider, summary, features, mindmap, documentText: this.mindmapToDocument(summary, mindmap) };
  }

  isLikelyImageDataUrl(imageSrc = '') {
    const match = imageSrc.match(/^data:image\/[a-z0-9.+-]+;base64,([a-z0-9+/=]+)$/i);
    return Boolean(match && match[1].length > 100);
  }

  buildImageMindmap({ title, imageAlt = '', context = '' }) {
    const features = this.extractFeatures(`${imageAlt} ${context}`).slice(0, 6);
    const summary = imageAlt || `Pasted UI capture for ${title}. Add notes to improve visual parsing.`;
    const mindmap = {
      label: title,
      description: summary,
      children: [
        { label: 'Visible UI', description: summary, children: features.slice(0, 3).map((feature) => ({ label: feature, description: `Potential UI capability or state: ${feature}.` })) },
        { label: 'QA focus', description: 'Validate key controls, visible state, and workflow expectations from this screen.', children: features.slice(3, 6).map((feature) => ({ label: feature, description: `Check expected behavior for ${feature}.` })) }
      ]
    };
    return { provider: 'extractive', summary, features, mindmap, documentText: this.mindmapToDocument(summary, mindmap) };
  }

  mindmapToDocument(summary, mindmap) {
    const lines = [summary];
    const walk = (node, depth = 0) => {
      if (!node) return;
      lines.push(`${'  '.repeat(depth)}- ${node.label}: ${node.description || ''}`.trim());
      (node.children || []).forEach((child) => walk(child, depth + 1));
    };
    walk(mindmap);
    return lines.join('\n');
  }

  parseJsonObject(content = '') {
    const trimmed = content.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    try {
      return JSON.parse(trimmed);
    } catch {
      const match = trimmed.match(/\{[\s\S]*\}/);
      if (!match) return null;
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
  }

  deleteMemory() {
    this.nodes.clear();
    this.edges = [];
    this.memoryInsights = [];
    this.memoryVersions = [];
    this.logs = [];
    this.sessions.clear();
    this.executionHistory = [];
    this.seeded = false;
    this.log('memory.delete', 'All graph memory, insights, versions, and execution sessions were deleted by the user.');
    this.persistSoon();
    return this.getState();
  }

  createSession({ command, agent, status = 'planning', targetUrl = '' }) {
    const session = { id: `session-${uuid()}`, command, agent, targetUrl, status, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), logs: [], screenshots: [], domSnapshots: [], memoryReferences: [], plan: [], failures: [], refinements: [] };
    this.sessions.set(session.id, session);
    return session;
  }

  appendSessionLog(sessionId, category, message, metadata = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    const log = { id: uuid(), timestamp: new Date().toISOString(), category, message, metadata };
    session.logs.push(log);
    session.updatedAt = log.timestamp;
    this.log(category, `[${sessionId}] ${message}`, metadata);
    return log;
  }

  retrieve(query, { limit = 6, types = [] } = {}) {
    const queryVector = vectorPipeline.embed(query);
    const terms = vectorPipeline.tokenize(query);
    return [...this.nodes.values()].filter((node) => !types.length || types.includes(node.type)).map((node) => {
      const lexical = this.scoreNode(node, terms);
      const semantic = node.embedding ? vectorPipeline.similarity(queryVector, node.embedding) : 0;
      return { node, score: Number((lexical + semantic).toFixed(4)), lexical, semantic };
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  }

  planExecution(command = '', agent = { name: 'Exploratory QA Agent' }) {
    const selectedNodes = this.retrieve(command, { limit: 7 }).map((item) => item.node);
    const plan = [
      'Retrieve semantic, procedural, and episodic memory for the requested workflow.',
      'Open an isolated browser context against the configured target URL.',
      'Inspect DOM landmarks and visible UI state before taking action.',
      'Execute risk-based exploratory steps and capture evidence.',
      'Persist observations, failures, screenshots, and graph refinements.'
    ];
    const needsClarification = !/\b(login|checkout|onboarding|profile|dashboard|settings|workflow|test|validate|explor)/i.test(command);
    return { plan, selectedNodes, needsClarification, reasoningSummary: `${agent.name} selected ${selectedNodes.length} memory node(s) using hybrid lexical/vector retrieval.` };
  }

  startExecutionSession({ command, agent, targetUrl = '' }) {
    const session = this.createSession({ command, agent: agent.name, status: 'running', targetUrl });
    const plan = this.planExecution(command, agent);
    session.plan = plan.plan;
    session.memoryReferences = plan.selectedNodes.map((node) => node.id);
    this.appendSessionLog(session.id, 'reasoning', plan.reasoningSummary, { selectedNodes: session.memoryReferences });
    plan.plan.forEach((step, index) => this.appendSessionLog(session.id, 'plan', `${index + 1}. ${step}`));
    if (plan.needsClarification) {
      session.status = 'blocked_needs_clarification';
      session.failures.push('The command does not identify a testable application workflow.');
    }
    return { session, plan };
  }

  completeExecutionSession(sessionId, { result, observations = [], screenshots = [], domSnapshots = [], failures = [] }) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Unknown session ${sessionId}`);
    session.screenshots.push(...screenshots);
    session.domSnapshots.push(...domSnapshots);
    session.failures.push(...failures);
    observations.forEach((observation) => this.appendSessionLog(session.id, observation.category || 'observation', observation.message, observation.metadata || {}));
    session.status = failures.length ? 'completed_with_findings' : 'completed';
    const insightId = `insight-${uuid()}`;
    this.upsertNode({ id: insightId, label: 'Execution learning', type: 'Insight', content: result, tags: ['execution-derived-learning'], confidence: failures.length ? 0.82 : 0.76 });
    session.memoryReferences.forEach((ref) => this.addEdge(ref, insightId, 'creates_insight'));
    session.refinements.push('Execution evidence persisted and linked to retrieved memory nodes.');
    this.executionHistory.unshift(session);
    this.createMemoryVersion('execution', `Session ${session.id} completed memory refinement.`, session.memoryReferences.concat(insightId));
    return { action: { result, session, plan: { plan: session.plan, selectedNodes: session.memoryReferences } }, state: this.getState() };
  }

  async chat(query) {
    const matches = this.retrieve(query, { limit: 5 });
    const evidence = matches.map((item) => `${item.node.type} ${item.node.label}: ${item.node.content || ''}`).join('\n');
    const system = 'You are an enterprise QA intelligence assistant. Answer only from provided memory evidence, include confidence, and mention when evidence is insufficient.';
    const llm = await llmProvider.complete({ system, messages: [{ role: 'user', content: `Question: ${query}\n\nMemory evidence:\n${evidence || 'No matching memory evidence.'}` }], metadata: { feature: 'chat' } });
    const answer = llm.content || (matches.length ? `Memory evidence found for ${matches.map((item) => `${item.node.type} "${item.node.label}"`).join('; ')}. Confidence is based on ${matches.length} retrieved graph/vector references.` : 'No matching organizational memory exists yet. Ingest source material before relying on this answer.');
    this.log('chat', `User asked "${query}". Agent returned ${matches.length} cited memory node(s).`, { provider: llm.provider, usage: llm.usage });
    return { answer, provider: llm.provider, usage: llm.usage, matches: matches.map((item) => ({ ...item.node, score: item.score })), state: this.getState() };
  }

  createMemoryVersion(reason, summary, sourceRefs = []) {
    const previous = this.memoryVersions[0];
    const graphHash = createHash('sha256').update(JSON.stringify({ nodes: [...this.nodes.keys()].sort(), edges: this.edges.map((edge) => `${edge.source}:${edge.relationship}:${edge.target}`).sort(), sourceRefs })).digest('hex');
    const version = { id: `memory-v${this.memoryVersions.length + 1}`, parentId: previous?.id || null, timestamp: new Date().toISOString(), reason, summary, sourceRefs, graphHash, nodeCount: this.nodes.size, edgeCount: this.edges.length, confidence: this.calculateConfidence() };
    this.memoryVersions.unshift(version);
    this.addInsight(summary, ['versioned-memory'], version.id);
    this.persistSoon();
    return version;
  }

  persistSoon() {
    if (typeof this.onPersist !== 'function') return;
    Promise.resolve(this.onPersist()).catch((error) => this.log('persistence.error', error.message));
  }

  calculateConfidence() {
    const nodes = [...this.nodes.values()];
    if (!nodes.length) return 0;
    return Number((nodes.reduce((sum, node) => sum + (node.confidence || 0.7), 0) / nodes.length).toFixed(2));
  }

  getState() {
    return { nodes: [...this.nodes.values()], edges: this.edges, logs: this.logs, memoryInsights: this.memoryInsights, memoryVersions: this.memoryVersions, sessions: [...this.sessions.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), agents: [], observability: observability.snapshot() };
  }

  log(category, message, metadata = {}) {
    const entry = observability.event(category, message, metadata);
    this.logs.unshift(entry);
    this.logs = this.logs.slice(0, 400);
    return entry;
  }

  addInsight(message, tags = [], versionId = null) {
    this.memoryInsights.unshift({ id: uuid(), timestamp: new Date().toISOString(), message, graphSize: this.nodes.size, tags, versionId, confidence: this.calculateConfidence() });
    this.memoryInsights = this.memoryInsights.slice(0, 200);
  }

  slugNode(prefix, label) {
    return `${prefix}-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
  }

  extractFeatures(content = '') {
    const candidates = content.split(/[.;\n]/).map((item) => item.trim()).filter((item) => item.length > 8).slice(0, 6);
    return candidates.length ? candidates : ['General onboarding flow'];
  }

  scoreNode(node, terms) {
    const haystack = `${node.label} ${node.type} ${node.content || ''} ${(node.tags || []).join(' ')}`.toLowerCase();
    return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
  }
}

export const knowledgeGraph = new KnowledgeGraphService();
