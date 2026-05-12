import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, Bot, Brain, Database, GitBranch, ImagePlus, MessageSquare, Network, Play, Settings, Shield, Trash2, Upload, Workflow, Zap } from 'lucide-react';
import './styles.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5050/api';
const WS_BASE = (import.meta.env.VITE_WS_BASE || API_BASE.replace(/^http/, 'ws').replace(/\/api$/, '')).replace(/\/$/, '');
const emptyAgentForm = { name: '', scope: 'qa', strategy: '', tools: 'dom.extract, mcp.registry.describe' };

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const payload = JSON.parse(text);
      message = payload.message || payload.error || text;
    } catch {
      message = text;
    }
    throw new Error(message || `Request failed with status ${response.status}`);
  }
  return response.json();
}

function App() {
  const [section, setSection] = useState('Dashboard');
  const [knowledgeTab, setKnowledgeTab] = useState('Graph');
  const [actionTab, setActionTab] = useState('Act');
  const [state, setState] = useState({ nodes: [], edges: [], logs: [], memoryInsights: [], memoryVersions: [], sessions: [], agents: [], tools: [] });
  const [chatHistory, setChatHistory] = useState([]);
  const [chatQuery, setChatQuery] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [command, setCommand] = useState('Validate the critical workflow in the configured application');
  const [targetUrl, setTargetUrl] = useState(import.meta.env.VITE_EXECUTION_BASE_URL || '');
  const [selectedAgent, setSelectedAgent] = useState('agent-exploratory-qa');
  const [enhanceForm, setEnhanceForm] = useState({ title: '', content: '', imageAlt: '', imageSrc: '', businessRule: '' });
  const [agentForm, setAgentForm] = useState(emptyAgentForm);
  const [stream, setStream] = useState([{ type: 'system', message: 'Waiting for live execution stream…' }]);
  const [lastAction, setLastAction] = useState(null);
  const [liveFrame, setLiveFrame] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (state.agents.length && !state.agents.some((agent) => agent.id === selectedAgent)) setSelectedAgent(state.agents[0].id);
  }, [state.agents, selectedAgent]);
  useEffect(() => {
    const socket = new WebSocket(`${WS_BASE}/ws/executions`);
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'browser.frame') setLiveFrame(payload.frame);
      if (payload.type === 'session.started') setLiveFrame(null);
      setStream((items) => [payload, ...items].slice(0, 80));
    };
    socket.onerror = () => setStream((items) => [{ type: 'warning', message: 'WebSocket unavailable; REST execution still works.' }, ...items]);
    return () => socket.close();
  }, []);

  function applyState(nextState) {
    setState((previous) => ({
      ...nextState,
      agents: nextState?.agents?.length ? nextState.agents : previous.agents,
      tools: nextState?.tools?.length ? nextState.tools : previous.tools
    }));
  }

  function showNotice(type, message) { setNotice({ type, message }); }

  async function refresh() {
    try {
      applyState(await api('/graph'));
      setNotice(null);
    } catch (error) {
      showNotice('error', `Unable to load application state: ${error.message}`);
    }
  }

  async function submitEnhancement(event) {
    event.preventDefault();
    try {
      applyState(await api('/enhance', { method: 'POST', body: JSON.stringify(enhanceForm) }));
      setEnhanceForm({ title: '', content: '', imageAlt: '', imageSrc: '', businessRule: '' });
      showNotice('success', 'Application memory was updated.');
    } catch (error) {
      showNotice('error', `Knowledge ingestion failed: ${error.message}`);
    }
  }

  async function runActionLoop(event) {
    event.preventDefault();
    try {
      setLiveFrame(null);
      const result = await api('/act', { method: 'POST', body: JSON.stringify({ command, agentId: selectedAgent, targetUrl }) });
      setLastAction(result.action);
      setLiveFrame(result.action?.session?.screenshots?.[0] || null);
      applyState(result.state);
      showNotice('success', 'Action loop completed and refreshed agents.');
    } catch (error) {
      showNotice('error', `Action loop failed: ${error.message}`);
    }
  }

  async function sendChat(event) {
    event.preventDefault();
    const query = chatQuery.trim();
    if (!query || chatLoading) return;
    setChatLoading(true);
    try {
      const result = await api('/chat', { method: 'POST', body: JSON.stringify({ query }) });
      setChatHistory((history) => [{ query, answer: result.answer, matches: result.matches || [] }, ...history]);
      applyState(result.state);
      setChatQuery('');
      showNotice('success', 'Chat answer generated from memory.');
    } catch (error) {
      showNotice('error', `Chat failed: ${error.message}`);
    } finally {
      setChatLoading(false);
    }
  }

  async function addAgent(event) {
    event.preventDefault();
    try {
      const result = await api('/agents', {
        method: 'POST',
        body: JSON.stringify({ ...agentForm, tools: agentForm.tools.split(',').map((tool) => tool.trim()).filter(Boolean) })
      });
      applyState(result.state);
      setSelectedAgent(result.agent.id);
      setAgentForm(emptyAgentForm);
      showNotice('success', `Agent "${result.agent.name}" was added.`);
    } catch (error) {
      showNotice('error', `Unable to add agent: ${error.message}`);
    }
  }

  async function deleteMemory() {
    if (!window.confirm('Delete all graph memory, versions, sessions, and insights?')) return;
    try {
      applyState(await api('/memory', { method: 'DELETE' }));
      setChatHistory([]);
      setLastAction(null);
      setLiveFrame(null);
      showNotice('success', 'Memory deleted.');
    } catch (error) {
      showNotice('error', `Unable to delete memory: ${error.message}`);
    }
  }

  const counts = useMemo(() => state.nodes.reduce((acc, node) => ({ ...acc, [node.type]: (acc[node.type] || 0) + 1 }), {}), [state.nodes]);
  const nav = ['Dashboard', 'Knowledge', 'Actions', 'Memory', 'Sessions', 'Agents', 'Settings'];

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="brand"><span><Bot size={22} /></span><b>QA Master</b><small>Agent OS</small></div>
        <nav>{nav.map((item) => <button key={item} className={section === item ? 'active' : ''} onClick={() => setSection(item)}>{iconFor(item)}{item}</button>)}</nav>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">Operational AI QA platform</p><h1>{section}</h1></div>
          <div className="status"><span className="pulse" /> Live memory · {state.memoryVersions.length || 0} versions</div>
        </header>
        {notice && <div className={`notice ${notice.type}`} role="status">{notice.message}</div>}
        {section === 'Dashboard' && <Dashboard counts={counts} state={state} setSection={setSection} />}
        {section === 'Knowledge' && <Knowledge tabs={{ knowledgeTab, setKnowledgeTab }} state={state} form={enhanceForm} setForm={setEnhanceForm} onSubmit={submitEnhancement} />}
        {section === 'Actions' && <Actions actionTab={actionTab} setActionTab={setActionTab} command={command} setCommand={setCommand} agents={state.agents} selectedAgent={selectedAgent} setSelectedAgent={setSelectedAgent} onRun={runActionLoop} lastAction={lastAction} liveFrame={liveFrame} logs={state.logs} stream={stream} targetUrl={targetUrl} setTargetUrl={setTargetUrl} chat={{ chatQuery, setChatQuery, sendChat, chatHistory, chatLoading }} />}
        {section === 'Memory' && <Memory state={state} onDeleteMemory={deleteMemory} />}
        {section === 'Sessions' && <Sessions sessions={state.sessions} />}
        {section === 'Agents' && <Agents agents={state.agents} tools={state.tools} agentForm={agentForm} setAgentForm={setAgentForm} onAddAgent={addAgent} />}
        {section === 'Settings' && <SettingsPanel />}
      </main>
    </div>
  );
}

function iconFor(item) {
  const icons = { Dashboard: <Activity size={18} />, Knowledge: <Network size={18} />, Actions: <Zap size={18} />, Memory: <Brain size={18} />, Sessions: <Workflow size={18} />, Agents: <Bot size={18} />, Settings: <Settings size={18} /> };
  return icons[item];
}

function Dashboard({ counts, state, setSection }) {
  return <section className="grid two"><div className="hero-card"><p className="eyebrow">Persistent application intelligence</p><h2>Onboard agents like human QA engineers.</h2><p>The platform combines graph memory, RAG chunks, version lineage, agent profiles, WebSocket execution streaming, and session replay evidence.</p><button onClick={() => setSection('Actions')} className="primary"><Play size={16} /> Run exploratory session</button></div><div className="metric-grid">{Object.entries(counts).map(([type, count]) => <article className="metric" key={type}><b>{count}</b><span>{type}</span></article>)}</div><LogPanel logs={state.logs} /><VersionPanel versions={state.memoryVersions} /></section>;
}

function Knowledge({ tabs, state, form, setForm, onSubmit }) {
  const names = ['Graph', 'Memory Insights', 'Enhance'];
  return <section className="panel"><TabBar tabs={names} active={tabs.knowledgeTab} onChange={tabs.setKnowledgeTab} />{tabs.knowledgeTab === 'Graph' && <GraphTab state={state} />}{tabs.knowledgeTab === 'Memory Insights' && <Memory state={state} />}{tabs.knowledgeTab === 'Enhance' && <EnhanceTab form={form} setForm={setForm} onSubmit={onSubmit} logs={state.logs} />}</section>;
}

function GraphTab({ state }) {
  const featured = state.nodes.filter((node) => ['Workflow', 'Screen', 'BusinessRule', 'Action', 'Feature', 'Document', 'Insight'].includes(node.type)).slice(0, 34);
  const [selectedNode, setSelectedNode] = useState(featured[0] || null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    if (!selectedNode && featured.length) setSelectedNode(featured[0]);
  }, [featured, selectedNode]);
  const selectedEdges = selectedNode ? state.edges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id) : [];
  const selectedMindmap = selectedNode?.mindmap;
  return <div className="grid two"><section className="card wide"><div className="section-heading"><h2><Network size={20} /> Interactive knowledge graph</h2><div className="zoom-controls"><button type="button" onClick={() => setZoom(Math.max(.65, zoom - .15))}>−</button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom(Math.min(1.8, zoom + .15))}>+</button></div></div><div className="graph-canvas zoomable"><div className="graph-surface" style={{ transform: `scale(${zoom})` }}>{featured.map((node, index) => <button type="button" className={`node node-${node.type.toLowerCase()} ${selectedNode?.id === node.id ? 'selected' : ''}`} style={{ '--i': index }} key={node.id} onClick={() => setSelectedNode(node)}><strong>{node.label}</strong><span>{node.type} · {Math.round((node.confidence || .7) * 100)}%</span></button>)}</div></div></section><section className="card node-detail"><h2>Selected knowledge node</h2>{selectedNode ? <><span>{selectedNode.type}</span><h3>{selectedNode.label}</h3><p>{selectedNode.content || 'No details captured yet.'}</p><small>ID: {selectedNode.id}</small>{selectedMindmap && <Mindmap node={selectedMindmap} />}<h4>Relationships</h4><div className="edge-list compact">{selectedEdges.length ? selectedEdges.map((edge) => <p key={edge.id}>{edge.source} <b>{edge.relationship}</b> {edge.target}</p>) : <p>No direct relationships.</p>}</div></> : <Empty title="No node selected" body="Click a graph node to inspect its memory details." />}</section><section className="card wide image-grid">{state.nodes.filter((node) => node.type === 'Screen' && node.src).map((image) => <figure key={image.id}><img src={image.src} alt={image.content} /><figcaption>{image.label}</figcaption></figure>)}</section></div>;
}

function Mindmap({ node }) {
  return <div className="mindmap" aria-label="Readable memory mindmap"><MindmapBranch node={node} depth={0} /></div>;
}

function MindmapBranch({ node, depth }) {
  return <article className="mindmap-branch" style={{ '--depth': depth }}><b>{node.label}</b>{node.description && <p>{node.description}</p>}{Boolean(node.children?.length) && <div>{node.children.map((child, index) => <MindmapBranch node={child} depth={depth + 1} key={`${child.label}-${index}`} />)}</div>}</article>;
}

function Memory({ state, onDeleteMemory }) {
  return <div className="grid two"><section className="card memory-actions"><h2><Brain size={20} /> Memory controls</h2><p>Delete memory when you need a clean graph, empty sessions, and fresh version lineage.</p>{onDeleteMemory && <button className="danger" onClick={onDeleteMemory}><Trash2 size={16} /> Delete memory</button>}</section><VersionPanel versions={state.memoryVersions} /><section className="card wide"><h2><GitBranch size={20} /> Memory lineage and refinements</h2>{state.memoryInsights.map((insight) => <article className="timeline-item" key={insight.id}><time>{new Date(insight.timestamp).toLocaleString()}</time><p>{insight.message}</p><span>{insight.graphSize} nodes · confidence {Math.round((insight.confidence || 0) * 100)}% · {(insight.tags || []).join(', ')}</span></article>)}</section></div>;
}

function EnhanceTab({ form, setForm, onSubmit, logs }) {
  function onPaste(event) {
    const imageItem = [...event.clipboardData.items].find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    event.preventDefault();
    const file = imageItem.getAsFile();
    const reader = new FileReader();
    reader.onload = () => setForm({
      ...form,
      imageSrc: reader.result,
      imageAlt: form.imageAlt || 'Pasted UI image: analyze visible screens, controls, labels, state, and QA risks.',
      content: form.content || 'Visual application capture pasted from clipboard. Parse this image into readable QA memory and a mindmap.'
    });
    reader.readAsDataURL(file);
  }
  return <div className="grid two"><section className="card"><h2><Upload size={20} /> Enhance application memory</h2><form className="stack" onSubmit={onSubmit}><label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label><label>Onboarding document / notes<textarea value={form.content} onPaste={onPaste} onChange={(e) => setForm({ ...form, content: e.target.value })} rows="6" placeholder="Type notes, or paste an image directly here to parse it into graph memory." /></label><label>Paste image or add UI capture notes<textarea value={form.imageAlt} onPaste={onPaste} onChange={(e) => setForm({ ...form, imageAlt: e.target.value })} rows="3" placeholder="Paste an image here, or describe the screenshot." /></label>{form.imageSrc && <figure className="pasted-preview"><img src={form.imageSrc} alt={form.imageAlt || 'Pasted UI preview'} /><figcaption><ImagePlus size={14} /> Pasted image will be parsed into a readable, zoomable mindmap node</figcaption></figure>}<label>Business rule / clarification<textarea value={form.businessRule} onChange={(e) => setForm({ ...form, businessRule: e.target.value })} rows="3" /></label><button className="primary">Run ingestion pipeline</button></form></section><LogPanel logs={logs} /></div>;
}

function Actions(props) {
  const tabs = ['Act', 'Chat'];
  return <section className="panel"><TabBar tabs={tabs} active={props.actionTab} onChange={props.setActionTab} />{props.actionTab === 'Act' ? <ActTab {...props} /> : <ChatTab {...props.chat} logs={props.logs} />}</section>;
}

function ActTab({ command, setCommand, targetUrl, setTargetUrl, agents, selectedAgent, setSelectedAgent, onRun, lastAction, liveFrame, logs, stream }) {
  const frame = liveFrame || lastAction?.session?.screenshots?.[0];
  const activeSession = stream.find((event) => event.sessionId)?.sessionId;
  return <div className="execution-layout"><section className="card console"><h2><Play size={20} /> Operational execution console</h2><form onSubmit={onRun} className="stack"><label>High-level QA command<textarea value={command} onChange={(e) => setCommand(e.target.value)} rows="3" required /></label><label>Target application URL<input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://app.example.com" /></label><label>Agent<select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)} disabled={!agents.length}>{agents.length ? agents.map((agent) => <option value={agent.id} key={agent.id}>{agent.name}</option>) : <option>Loading agents…</option>}</select></label><button className="primary"><Zap size={16} /> Execute with live stream</button></form><h3>Live execution logs</h3><div className="terminal">{stream.map((event, index) => <p key={index}><b>{event.type}</b> {event.frame?.label || event.log?.message || event.message || event.session?.status || event.sessionId}</p>)}</div><LogPanel logs={logs} /></section><section className="card viewer"><div className="section-heading"><h2>Live UI execution viewer</h2>{activeSession && <span className="live-pill"><span className="pulse" /> {frame ? 'Streaming frames' : 'Waiting for frame'}</span>}</div>{frame?.src ? <div className="browser-frame live"><div className="browser-bar"><span /><span /><span /><small>{frame.url || frame.label}</small></div><img src={frame.src} alt={frame.label || 'Latest live execution frame'} /><div className="highlight">{frame.stepLabel || 'Live frame'}</div></div> : <Empty title="No live browser frame yet" body="When the agent navigates or acts, screenshots stream here immediately instead of waiting for the final captured image." />}{lastAction && <pre>{lastAction.result}</pre>}</section></div>;
}

function ChatTab({ chatQuery, setChatQuery, sendChat, chatHistory, logs, chatLoading }) {
  return <div className="grid two"><section className="card chat-card"><h2><MessageSquare size={20} /> Memory-backed agent chat</h2><form className="chat-form" onSubmit={sendChat}><input value={chatQuery} onChange={(e) => setChatQuery(e.target.value)} placeholder="Ask about workflows, validations, recurring failures…" required disabled={chatLoading} /><button className="primary" disabled={chatLoading}>{chatLoading ? 'Thinking…' : <><Bot size={16} /> Ask</>}</button></form>{chatLoading && <div className="chat-loader" role="status"><span /> Generating answer from graph memory…</div>}<div className="chat-history">{chatHistory.map((item, index) => <article key={index}><b>You:</b> {item.query}<p><b>Agent:</b> {item.answer}</p><small>Sources: {item.matches.map((match) => match.label).join(', ') || 'None'}</small></article>)}</div></section><LogPanel logs={logs} /></div>;
}

function Sessions({ sessions }) {
  return <section className="grid two">{sessions.length ? sessions.map((session) => <article className="card" key={session.id}><h2>{session.command}</h2><p><b>Status:</b> {session.status}</p><p><b>Agent:</b> {session.agent}</p><p><b>Memory refs:</b> {session.memoryReferences.join(', ') || 'None'}</p><details><summary>Replay logs</summary>{session.logs.map((log) => <p key={log.id}>{log.category}: {log.message}</p>)}</details></article>) : <Empty title="No sessions yet" body="Run an action to create a replayable execution session." />}</section>;
}

function Agents({ agents, tools, agentForm, setAgentForm, onAddAgent }) {
  return <div className="grid two"><section className="card"><h2><Bot size={20} /> Add an agent</h2><form className="stack" onSubmit={onAddAgent}><label>Name<input value={agentForm.name} onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })} placeholder="Accessibility QA Agent" required /></label><label>Scope<input value={agentForm.scope} onChange={(e) => setAgentForm({ ...agentForm, scope: e.target.value })} placeholder="qa" /></label><label>Strategy<textarea value={agentForm.strategy} onChange={(e) => setAgentForm({ ...agentForm, strategy: e.target.value })} rows="3" placeholder="How this agent should plan and execute work" /></label><label>Tools<input value={agentForm.tools} onChange={(e) => setAgentForm({ ...agentForm, tools: e.target.value })} placeholder="dom.extract, mcp.registry.describe" /></label><button className="primary"><Bot size={16} /> Add agent</button></form></section><section className="card"><h2><Bot size={20} /> Specialized agents</h2>{agents.map((agent) => <article className="timeline-item" key={agent.id}><b>{agent.name}</b><p>{agent.strategy}</p><span>Scope: {agent.scope} · Tools: {agent.tools.join(', ')}</span></article>)}</section><section className="card wide"><h2><Database size={20} /> MCP-compatible tool registry</h2>{tools.map((tool) => <article className="timeline-item" key={tool.name}><b>{tool.name}</b><p>{tool.description}</p><span>{tool.permissions.join(', ')}</span></article>)}</section></div>;
}

function SettingsPanel() {
  return <div className="grid two"><section className="card"><h2><Shield size={20} /> Security controls</h2><ul><li>API key protection and RBAC-ready service boundaries</li><li>Scoped tool permissions and audit log</li><li>Session isolation and execution replay boundaries</li><li>Environment-driven secrets and service configuration</li></ul></section><section className="card"><h2>Infrastructure adapters</h2><ul><li>PostgreSQL + pgvector schema</li><li>Neo4j graph schema</li><li>Redis queue/session orchestration</li><li>Docker Compose for local production parity</li></ul></section></div>;
}

function VersionPanel({ versions }) {
  return <section className="card"><h2><Brain size={20} /> Versioned memory states</h2>{versions.length ? versions.map((version) => <article className="timeline-item version" key={version.id}><b>{version.id}</b><p>{version.summary}</p><span>{version.nodeCount} nodes · {version.edgeCount} edges · confidence {Math.round(version.confidence * 100)}% · parent {version.parentId || 'root'}</span></article>) : <p>No memory versions yet.</p>}</section>;
}

function LogPanel({ logs }) {
  return <section className="card log-panel"><h2>Audit trail</h2>{logs.slice(0, 18).map((log) => <article key={log.id}><span>{log.category}</span><p>{log.message}</p><time>{new Date(log.timestamp).toLocaleTimeString()}</time></article>)}</section>;
}

function TabBar({ tabs, active, onChange }) {
  return <div className="sub-tabs">{tabs.map((tab) => <button type="button" className={active === tab ? 'active' : ''} onClick={() => onChange(tab)} key={tab}>{tab}</button>)}</div>;
}

function Empty({ title, body }) {
  return <section className="empty-state"><h2>{title}</h2><p>{body}</p></section>;
}

createRoot(document.getElementById('root')).render(<App />);
