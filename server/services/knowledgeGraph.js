import { randomUUID as uuid } from 'node:crypto';
import { sampleDocuments, sampleImages, sampleBusinessRules, sampleWorkflows } from '../data/sampleContent.js';
import { vectorPipeline } from './vectorPipeline.js';
import { observability } from './observability.js';

export class KnowledgeGraphService {
  constructor() {
    this.nodes = new Map();
    this.edges = [];
    this.logs = [];
    this.memoryInsights = [];
    this.memoryVersions = [];
    this.sessions = new Map();
    this.executionHistory = [];
    this.actionCursor = 0;
    this.seeded = false;
  }

  seed() {
    if (this.seeded) return this.getState();
    this.log('system', 'Seeding production MVP knowledge package: documents, workflows, screens, and rules.');
    sampleDocuments.forEach((document) => this.ingestDocument(document, { seed: true, sourceType: 'onboarding_document' }));
    sampleImages.forEach((image) => this.ingestImage(image, { seed: true }));
    sampleWorkflows.forEach((workflow) => this.ingestWorkflow(workflow, { seed: true }));
    sampleBusinessRules.forEach((rule) => this.ingestRule(rule, { seed: true }));
    this.createMemoryVersion('seed', 'Initial memory created from sample onboarding package.', ['sample:onboarding']);
    this.seeded = true;
    return this.getState();
  }

  upsertNode(node) {
    const existing = this.nodes.get(node.id) || {};
    const merged = {
      confidence: 0.72,
      tags: [],
      createdAt: existing.createdAt || new Date().toISOString(),
      ...existing,
      ...node,
      updatedAt: new Date().toISOString()
    };
    this.nodes.set(node.id, merged);
    return merged;
  }

  addEdge(source, target, relationship, properties = {}) {
    const exists = this.edges.some((edge) => edge.source === source && edge.target === target && edge.relationship === relationship);
    if (!exists) this.edges.push({ id: uuid(), source, target, relationship, confidence: properties.confidence || 0.76, ...properties });
  }

  ingestDocument(document, options = {}) {
    const documentId = document.id || `doc-${uuid()}`;
    const chunks = vectorPipeline.chunkKnowledge(document.content || '');
    this.upsertNode({
      id: documentId,
      label: document.title || 'Untitled document',
      type: 'Document',
      content: document.content || '',
      source: options.seed ? 'sample' : 'user upload',
      sourceType: options.sourceType || 'document',
      tags: ['semantic-memory'],
      embedding: vectorPipeline.embed(`${document.title || ''} ${document.content || ''}`)
    });

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
    if (!options.seed) this.createMemoryVersion('ingestion', `Ingested ${document.title || documentId}.`, [documentId]);
    return this.getState();
  }

  ingestImage(image, options = {}) {
    const imageId = image.id || `screen-${uuid()}`;
    this.upsertNode({
      id: imageId,
      label: image.title || 'Untitled UI image',
      type: 'Screen',
      content: image.alt || 'UI image example',
      src: image.src,
      source: options.seed ? 'sample' : 'user upload',
      tags: ['perception-memory'],
      embedding: vectorPipeline.embed(`${image.title || ''} ${image.alt || ''}`)
    });
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
    this.upsertNode({ id: workflowId, label: workflow.name, type: 'Workflow', content: workflow.goal, source: options.seed ? 'sample' : 'user', tags: ['workflow'] });
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
    this.upsertNode({ id: ruleId, label: rule.name, type: 'BusinessRule', content: rule.description, source: options.seed ? 'sample' : 'user', confidence: rule.confidence || 0.8, tags: ['business-rule'] });
    (rule.validations || []).forEach((validation) => {
      const validationId = this.slugNode('validation', validation);
      this.upsertNode({ id: validationId, label: validation, type: 'Validation', content: validation, tags: ['validation'] });
      this.addEdge(ruleId, validationId, 'requires_validation');
    });
    this.log('ingest', `Added business rule "${rule.name}" with validation coverage.`);
    return this.getState();
  }

  enhanceKnowledge({ title, content, imageAlt, businessRule }) {
    const features = this.extractFeatures(content);
    this.ingestDocument({ title, content, features }, { seed: false });
    if (imageAlt?.trim()) this.ingestImage({ title: `${title} UI note`, alt: imageAlt, features }, { seed: false });
    if (businessRule?.trim()) this.ingestRule({ name: `${title} rule`, description: businessRule, validations: this.extractFeatures(businessRule), confidence: 0.66 }, { seed: false });
    this.log('enhance', `Enhance pipeline parsed "${title}", generated embeddings, and refreshed graph lineage.`);
    return this.getState();
  }

  createSession({ command, agent, status = 'planning' }) {
    const session = { id: `session-${uuid()}`, command, agent, status, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), logs: [], screenshots: [], memoryReferences: [], plan: [], failures: [], refinements: [] };
    this.sessions.set(session.id, session);
    return session;
  }

  appendSessionLog(sessionId, category, message, metadata = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    const log = { id: uuid(), timestamp: new Date().toISOString(), category, message, metadata };
    session.logs.push(log);
    session.updatedAt = log.timestamp;
    this.log(category, `[${sessionId}] ${message}`);
    return log;
  }

  retrieve(query, { limit = 6, types = [] } = {}) {
    const queryVector = vectorPipeline.embed(query);
    const terms = vectorPipeline.tokenize(query);
    return [...this.nodes.values()]
      .filter((node) => !types.length || types.includes(node.type))
      .map((node) => {
        const lexical = this.scoreNode(node, terms);
        const semantic = node.embedding ? vectorPipeline.similarity(queryVector, node.embedding) : 0;
        return { node, score: Number((lexical + semantic).toFixed(4)), lexical, semantic };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  planExecution(command, agent) {
    const matches = this.retrieve(command, { limit: 5 });
    const selectedNodes = matches.map((item) => item.node);
    const plan = [
      'Retrieve relevant semantic, workflow, visual, and execution memory.',
      'Identify target workflow, validations, user roles, and highest-risk branches.',
      'Execute browser observation pass: navigate, extract DOM, capture screenshot, and verify landmarks.',
      'Run exploratory checks across happy path, boundary inputs, permissions, and recoverability.',
      'Reflect on anomalies, update memory version, and emit explainable session summary.'
    ];
    const needsClarification = !selectedNodes.length || /\b(which|what app|where)\b/i.test(command);
    return { plan, selectedNodes, needsClarification, reasoningSummary: `${agent.name} selected ${selectedNodes.length} memory node(s) using hybrid lexical/vector retrieval.` };
  }

  simulateAction(command = 'Perform exploratory testing on checkout flow', agent = { name: 'Exploratory QA Agent' }) {
    const session = this.createSession({ command, agent: agent.name, status: 'running' });
    const plan = this.planExecution(command, agent);
    session.plan = plan.plan;
    session.memoryReferences = plan.selectedNodes.map((node) => node.id);
    this.appendSessionLog(session.id, 'reasoning', plan.reasoningSummary, { selectedNodes: session.memoryReferences });
    plan.plan.forEach((step, index) => this.appendSessionLog(session.id, 'plan', `${index + 1}. ${step}`));

    const actionNodes = plan.selectedNodes.filter((node) => node.type === 'Action');
    const candidates = actionNodes.length ? actionNodes : [...this.nodes.values()].filter((node) => node.type === 'Action');
    const actionNode = candidates[this.actionCursor % Math.max(candidates.length, 1)];
    this.actionCursor += 1;
    const result = actionNode
      ? `Executed plan against "${actionNode.label}": captured DOM landmarks, validated expected feedback, queued boundary and accessibility checks, and found no blocking anomaly in the simulated executor.`
      : 'No executable action node was available; clarification is required before browser execution.';
    this.appendSessionLog(session.id, 'tool', 'Tool dom.extract completed with semantic UI regions.', { tool: 'dom.extract' });
    this.appendSessionLog(session.id, 'browser', 'Captured screenshot frame and highlighted active UI target.', { screenshot: '/samples/checkout.svg' });
    this.appendSessionLog(session.id, 'validation', result);
    session.screenshots.push({ id: uuid(), timestamp: new Date().toISOString(), src: '/samples/checkout.svg', label: 'Latest execution frame' });
    session.status = plan.needsClarification ? 'blocked_needs_clarification' : 'completed';
    if (plan.needsClarification) session.failures.push('Agent requires target application URL or workflow clarification.');
    session.refinements.push('Execution memory linked to selected workflow and action nodes.');
    this.executionHistory.unshift(session);
    const insightId = `insight-${uuid()}`;
    this.upsertNode({ id: insightId, label: 'Execution learning', type: 'Insight', content: result, tags: ['execution-derived-learning'] });
    if (actionNode) this.addEdge(actionNode.id, insightId, 'creates_insight');
    this.createMemoryVersion('execution', `Session ${session.id} completed memory refinement.`, session.memoryReferences.concat(insightId));
    return { action: { node: actionNode, result, session, plan }, state: this.getState() };
  }

  chat(query) {
    const matches = this.retrieve(query, { limit: 5 });
    const answer = matches.length
      ? `Based on graph memory, the strongest evidence is ${matches.map((item) => `${item.node.type} "${item.node.label}"`).join('; ')}. Use the linked workflow and validation nodes to plan the next QA action.`
      : 'I could not find strong graph evidence yet. Add onboarding material or a clarification in Knowledge > Enhance, then ask again.';
    this.log('chat', `User asked "${query}". Agent returned ${matches.length} cited memory node(s).`);
    return { answer, matches: matches.map((item) => ({ ...item.node, score: item.score })), state: this.getState() };
  }

  createMemoryVersion(reason, summary, sourceRefs = []) {
    const previous = this.memoryVersions[0];
    const version = {
      id: `memory-v${this.memoryVersions.length + 1}`,
      parentId: previous?.id || null,
      timestamp: new Date().toISOString(),
      reason,
      summary,
      sourceRefs,
      graphHash: `${this.nodes.size}:${this.edges.length}:${sourceRefs.join('|')}`,
      nodeCount: this.nodes.size,
      edgeCount: this.edges.length,
      confidence: this.calculateConfidence()
    };
    this.memoryVersions.unshift(version);
    this.addInsight(summary, ['versioned-memory'], version.id);
    return version;
  }

  calculateConfidence() {
    const nodes = [...this.nodes.values()];
    if (!nodes.length) return 0;
    return Number((nodes.reduce((sum, node) => sum + (node.confidence || 0.7), 0) / nodes.length).toFixed(2));
  }

  getState() {
    return {
      nodes: [...this.nodes.values()],
      edges: this.edges,
      logs: this.logs,
      memoryInsights: this.memoryInsights,
      memoryVersions: this.memoryVersions,
      sessions: [...this.sessions.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      agents: [],
      sampleImages,
      observability: observability.snapshot()
    };
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

  tokenize(text = '') {
    return vectorPipeline.tokenize(text);
  }

  scoreNode(node, terms) {
    const haystack = `${node.label} ${node.type} ${node.content || ''} ${(node.tags || []).join(' ')}`.toLowerCase();
    return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
  }
}

export const knowledgeGraph = new KnowledgeGraphService();
