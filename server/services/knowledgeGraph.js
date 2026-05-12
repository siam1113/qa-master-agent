import { randomUUID as uuid } from 'node:crypto';
import { sampleDocuments, sampleImages } from '../data/sampleContent.js';

// KnowledgeGraphService owns the graph, action loop, chat retrieval, and memory log for the POC.
export class KnowledgeGraphService {
  constructor() {
    // Nodes are stored in a Map for simple NetworkX-like lookup by id.
    this.nodes = new Map();
    // Edges are plain records with source, target, and relationship labels.
    this.edges = [];
    // Logs are displayed in every UI tab so users can audit the agent's steps.
    this.logs = [];
    // Memory insights summarize how the graph changes after boot, ingestion, and actions.
    this.memoryInsights = [];
    // The cursor makes the Act tab deterministic and easy to demo.
    this.actionCursor = 0;
  }

  // Bootstraps the graph with sample onboarding text and UI screen examples.
  seed() {
    this.log('system', 'Seeding sample onboarding documents and UI image examples.');
    sampleDocuments.forEach((document) => this.ingestDocument(document, { seed: true }));
    sampleImages.forEach((image) => this.ingestImage(image, { seed: true }));
    this.addInsight('Initial memory created from sample onboarding package.');
    return this.getState();
  }

  // Adds or replaces a node while preserving useful metadata for the UI and chat agent.
  upsertNode(node) {
    const existing = this.nodes.get(node.id) || {};
    this.nodes.set(node.id, { ...existing, ...node, updatedAt: new Date().toISOString() });
    return this.nodes.get(node.id);
  }

  // Adds an edge only once, keeping the graph readable and avoiding duplicate visual links.
  addEdge(source, target, relationship) {
    const exists = this.edges.some(
      (edge) => edge.source === source && edge.target === target && edge.relationship === relationship
    );
    if (!exists) {
      this.edges.push({ id: uuid(), source, target, relationship });
    }
  }

  // Converts uploaded or sample text into Document, Feature, and Action nodes.
  ingestDocument(document, options = {}) {
    const documentId = document.id || `doc-${uuid()}`;
    this.upsertNode({
      id: documentId,
      label: document.title || 'Untitled document',
      type: 'Document',
      content: document.content || '',
      source: options.seed ? 'sample' : 'user upload'
    });

    // Every feature mentioned by a document becomes a reusable graph node.
    const features = document.features?.length ? document.features : this.extractFeatures(document.content || '');
    features.forEach((feature) => {
      const featureId = this.slugNode('feature', feature);
      const actionId = this.slugNode('action', `Explore ${feature}`);
      this.upsertNode({ id: featureId, label: feature, type: 'Feature', content: `Capability: ${feature}` });
      this.upsertNode({
        id: actionId,
        label: `Explore ${feature}`,
        type: 'Action',
        content: `Run exploratory checks for ${feature}.`
      });
      this.addEdge(documentId, featureId, 'mentions');
      this.addEdge(featureId, actionId, 'validated_by');
    });

    // Related screens link text onboarding material to visual UI examples.
    (document.relatedScreens || []).forEach((screenId) => this.addEdge(documentId, screenId, 'references_screen'));
    this.log('ingest', `Processed document "${document.title || documentId}" with ${features.length} feature nodes.`);
    this.addInsight(`Memory expanded with document "${document.title || documentId}".`);
    return this.getState();
  }

  // Converts a UI image example into a Screen node and links it to known features.
  ingestImage(image, options = {}) {
    const imageId = image.id || `screen-${uuid()}`;
    this.upsertNode({
      id: imageId,
      label: image.title || 'Untitled UI image',
      type: 'Screen',
      content: image.alt || 'UI image example',
      src: image.src,
      source: options.seed ? 'sample' : 'user upload'
    });

    // Screens are connected to features so the action loop can choose UI-focused tests.
    (image.features || []).forEach((feature) => {
      const featureId = this.slugNode('feature', feature);
      this.upsertNode({ id: featureId, label: feature, type: 'Feature', content: `Capability: ${feature}` });
      this.addEdge(featureId, imageId, 'shown_on');
    });
    this.log('ingest', `Processed UI image "${image.title || imageId}".`);
    this.addInsight(`Visual memory added for "${image.title || imageId}".`);
    return this.getState();
  }

  // Adds user-provided knowledge from the Enhance tab.
  enhanceKnowledge({ title, content, imageAlt }) {
    const features = this.extractFeatures(content);
    this.ingestDocument({ title, content, features }, { seed: false });
    if (imageAlt?.trim()) {
      this.ingestImage({ title: `${title} UI note`, alt: imageAlt, features }, { seed: false });
    }
    this.log('enhance', `Enhance tab added "${title}" and refreshed graph state.`);
    return this.getState();
  }

  // Simulates exploratory QA by picking the next actionable graph node and recording a test idea.
  simulateAction() {
    const actionNodes = [...this.nodes.values()].filter((node) => node.type === 'Action');
    if (!actionNodes.length) {
      this.log('act', 'No action nodes exist yet; add knowledge before running exploratory actions.');
      return { action: null, state: this.getState() };
    }

    // The deterministic cursor avoids hidden randomness while still showing an agent loop.
    const actionNode = actionNodes[this.actionCursor % actionNodes.length];
    this.actionCursor += 1;
    const relatedFeatures = this.edges
      .filter((edge) => edge.target === actionNode.id && edge.relationship === 'validated_by')
      .map((edge) => this.nodes.get(edge.source)?.label)
      .filter(Boolean);
    const result = `Selected "${actionNode.label}"; inspect happy path, boundary inputs, and error feedback for ${relatedFeatures.join(', ') || 'related feature'}.`;
    const insightId = `insight-${uuid()}`;
    this.upsertNode({ id: insightId, label: 'Exploratory action result', type: 'Insight', content: result });
    this.addEdge(actionNode.id, insightId, 'creates_insight');
    this.log('act', result);
    this.addInsight(result);
    return { action: { node: actionNode, result }, state: this.getState() };
  }

  // Answers a chat query with simple keyword retrieval over graph node labels and content.
  chat(query) {
    const terms = this.tokenize(query);
    const matches = [...this.nodes.values()]
      .map((node) => ({ node, score: this.scoreNode(node, terms) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    // The answer is explainable because it cites matching graph nodes rather than using opaque ML.
    const answer = matches.length
      ? `I found ${matches.length} relevant graph item(s): ${matches
          .map((item) => `${item.node.type} "${item.node.label}"`)
          .join('; ')}. Suggested next step: run the related action or add more detail in Knowledge > Enhance.`
      : 'I could not find a strong graph match yet. Add onboarding details in Knowledge > Enhance, then ask again.';
    this.log('chat', `User asked "${query}". Agent answered with ${matches.length} graph match(es).`);
    return { answer, matches: matches.map((item) => item.node), state: this.getState() };
  }

  // Returns a serializable snapshot for API consumers and optional persistence.
  getState() {
    return {
      nodes: [...this.nodes.values()],
      edges: this.edges,
      logs: this.logs,
      memoryInsights: this.memoryInsights,
      sampleImages
    };
  }

  // Records an auditable event with a timestamp and category.
  log(category, message) {
    this.logs.unshift({ id: uuid(), timestamp: new Date().toISOString(), category, message });
  }

  // Records a memory insight for the Memory Insights tab.
  addInsight(message) {
    this.memoryInsights.unshift({ id: uuid(), timestamp: new Date().toISOString(), message, graphSize: this.nodes.size });
  }

  // Creates stable ids from labels so repeated ingestion merges related concepts.
  slugNode(prefix, label) {
    return `${prefix}-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
  }

  // Extracts simple feature candidates from text by splitting into meaningful phrases.
  extractFeatures(content = '') {
    const candidates = content
      .split(/[.,;\n]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 8)
      .slice(0, 5);
    return candidates.length ? candidates : ['General onboarding flow'];
  }

  // Normalizes chat text into terms used by the retrieval scorer.
  tokenize(text = '') {
    return text.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2);
  }

  // Scores a node by counting query terms that appear in its searchable text.
  scoreNode(node, terms) {
    const haystack = `${node.label} ${node.type} ${node.content || ''}`.toLowerCase();
    return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
  }
}

// A singleton keeps the demo state shared across API routes.
export const knowledgeGraph = new KnowledgeGraphService();
