import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, Bot, Brain, Database, GitBranch, MessageSquare, Network, Play, Settings, Shield, Upload, Workflow, Zap } from 'lucide-react';
import './styles.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5050/api';
const WS_BASE = (import.meta.env.VITE_WS_BASE || API_BASE.replace(/^http/, 'ws').replace(/\/api$/, '')).replace(/\/$/, '');

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function App() {
  const [section, setSection] = useState('Dashboard');
  const [knowledgeTab, setKnowledgeTab] = useState('Graph');
  const [actionTab, setActionTab] = useState('Act');
  const [state, setState] = useState({ nodes: [], edges: [], logs: [], memoryInsights: [], memoryVersions: [], sessions: [], agents: [], tools: [] });
  const [chatHistory, setChatHistory] = useState([]);
  const [chatQuery, setChatQuery] = useState('');
  const [command, setCommand] = useState('Validate the critical workflow in the configured application');
  const [targetUrl, setTargetUrl] = useState(import.meta.env.VITE_EXECUTION_BASE_URL || '');
  const [selectedAgent, setSelectedAgent] = useState('agent-exploratory-qa');
  const [enhanceForm, setEnhanceForm] = useState({ title: '', content: '', imageAlt: '', businessRule: '' });
  const [stream, setStream] = useState([{ type: 'system', message: 'Waiting for live execution stream…' }]);
  const [lastAction, setLastAction] = useState(null);

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    const socket = new WebSocket(`${WS_BASE}/ws/executions`);
    socket.onmessage = (event) => setStream((items) => [JSON.parse(event.data), ...items].slice(0, 60));
    socket.onerror = () => setStream((items) => [{ type: 'warning', message: 'WebSocket unavailable; REST execution still works.' }, ...items]);
    return () => socket.close();
  }, []);

  async function refresh() { setState(await api('/graph')); }
  async function submitEnhancement(event) {
    event.preventDefault();
    setState(await api('/enhance', { method: 'POST', body: JSON.stringify(enhanceForm) }));
    setEnhanceForm({ title: '', content: '', imageAlt: '', businessRule: '' });
  }
  async function runActionLoop(event) {
    event.preventDefault();
    const result = await api('/act', { method: 'POST', body: JSON.stringify({ command, agentId: selectedAgent, targetUrl }) });
    setLastAction(result.action);
    setState(result.state);
  }
  async function sendChat(event) {
    event.preventDefault();
    const result = await api('/chat', { method: 'POST', body: JSON.stringify({ query: chatQuery }) });
    setChatHistory((history) => [{ query: chatQuery, answer: result.answer, matches: result.matches }, ...history]);
    setState(result.state);
    setChatQuery('');
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
        {section === 'Dashboard' && <Dashboard counts={counts} state={state} setSection={setSection} />}
        {section === 'Knowledge' && <Knowledge tabs={{ knowledgeTab, setKnowledgeTab }} state={state} form={enhanceForm} setForm={setEnhanceForm} onSubmit={submitEnhancement} />}
        {section === 'Actions' && <Actions actionTab={actionTab} setActionTab={setActionTab} command={command} setCommand={setCommand} agents={state.agents} selectedAgent={selectedAgent} setSelectedAgent={setSelectedAgent} onRun={runActionLoop} lastAction={lastAction} logs={state.logs} stream={stream} targetUrl={targetUrl} setTargetUrl={setTargetUrl} chat={{ chatQuery, setChatQuery, sendChat, chatHistory }} />}
        {section === 'Memory' && <Memory state={state} />}
        {section === 'Sessions' && <Sessions sessions={state.sessions} />}
        {section === 'Agents' && <Agents agents={state.agents} tools={state.tools} />}
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
  const featured = state.nodes.filter((node) => ['Workflow', 'Screen', 'BusinessRule', 'Action', 'Feature'].includes(node.type)).slice(0, 34);
  return <div className="grid two"><section className="card wide"><h2><Network size={20} /> Interactive knowledge graph</h2><div className="graph-canvas">{featured.map((node, index) => <article className={`node node-${node.type.toLowerCase()}`} style={{ '--i': index }} key={node.id}><strong>{node.label}</strong><span>{node.type} · {Math.round((node.confidence || .7) * 100)}%</span></article>)}</div></section><section className="card"><h2>Relationship trace</h2><div className="edge-list">{state.edges.slice(0, 28).map((edge) => <p key={edge.id}>{edge.source} <b>{edge.relationship}</b> {edge.target}</p>)}</div></section><section className="card wide image-grid">{state.nodes.filter((node) => node.type === 'Screen' && node.src).map((image) => <figure key={image.id}><img src={image.src} alt={image.content} /><figcaption>{image.label}</figcaption></figure>)}</section></div>;
}

function Memory({ state }) {
  return <div className="grid two"><VersionPanel versions={state.memoryVersions} /><section className="card"><h2><GitBranch size={20} /> Memory lineage and refinements</h2>{state.memoryInsights.map((insight) => <article className="timeline-item" key={insight.id}><time>{new Date(insight.timestamp).toLocaleString()}</time><p>{insight.message}</p><span>{insight.graphSize} nodes · confidence {Math.round((insight.confidence || 0) * 100)}% · {(insight.tags || []).join(', ')}</span></article>)}</section></div>;
}

function EnhanceTab({ form, setForm, onSubmit, logs }) {
  return <div className="grid two"><section className="card"><h2><Upload size={20} /> Enhance application memory</h2><form className="stack" onSubmit={onSubmit}><label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label><label>Onboarding document / notes<textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required rows="6" /></label><label>Screenshot or UI capture notes<textarea value={form.imageAlt} onChange={(e) => setForm({ ...form, imageAlt: e.target.value })} rows="3" /></label><label>Business rule / clarification<textarea value={form.businessRule} onChange={(e) => setForm({ ...form, businessRule: e.target.value })} rows="3" /></label><button className="primary">Run ingestion pipeline</button></form></section><LogPanel logs={logs} /></div>;
}

function Actions(props) {
  const tabs = ['Act', 'Chat'];
  return <section className="panel"><TabBar tabs={tabs} active={props.actionTab} onChange={props.setActionTab} />{props.actionTab === 'Act' ? <ActTab {...props} /> : <ChatTab {...props.chat} logs={props.logs} />}</section>;
}

function ActTab({ command, setCommand, targetUrl, setTargetUrl, agents, selectedAgent, setSelectedAgent, onRun, lastAction, logs, stream }) {
  return <div className="execution-layout"><section className="card console"><h2><Play size={20} /> Operational execution console</h2><form onSubmit={onRun} className="stack"><label>High-level QA command<textarea value={command} onChange={(e) => setCommand(e.target.value)} rows="3" required /></label><label>Target application URL<input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://app.example.com" /></label><label>Agent<select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}>{agents.map((agent) => <option value={agent.id} key={agent.id}>{agent.name}</option>)}</select></label><button className="primary"><Zap size={16} /> Execute with live stream</button></form><h3>Live execution logs</h3><div className="terminal">{stream.map((event, index) => <p key={index}><b>{event.type}</b> {event.log?.message || event.message || event.session?.status || event.sessionId}</p>)}</div><LogPanel logs={logs} /></section><section className="card viewer"><h2>Live UI execution viewer</h2>{lastAction?.session?.screenshots?.[0]?.src ? <div className="browser-frame"><div className="browser-bar"><span /><span /><span /></div><img src={lastAction.session.screenshots[0].src} alt="Latest execution frame" /><div className="highlight">Captured frame</div></div> : <Empty title="No browser frame captured" body="Provide a reachable target URL and run an execution to stream real browser evidence." />}{lastAction && <pre>{lastAction.result}</pre>}</section></div>;
}

function ChatTab({ chatQuery, setChatQuery, sendChat, chatHistory, logs }) {
  return <div className="grid two"><section className="card"><h2><MessageSquare size={20} /> Memory-backed agent chat</h2><form className="chat-form" onSubmit={sendChat}><input value={chatQuery} onChange={(e) => setChatQuery(e.target.value)} placeholder="Ask about workflows, validations, recurring failures…" required /><button className="primary"><Bot size={16} /> Ask</button></form><div className="chat-history">{chatHistory.map((item, index) => <article key={index}><b>You:</b> {item.query}<p><b>Agent:</b> {item.answer}</p><small>Sources: {item.matches.map((match) => match.label).join(', ')}</small></article>)}</div></section><LogPanel logs={logs} /></div>;
}

function Sessions({ sessions }) {
  return <section className="grid two">{sessions.length ? sessions.map((session) => <article className="card" key={session.id}><h2>{session.command}</h2><p><b>Status:</b> {session.status}</p><p><b>Agent:</b> {session.agent}</p><p><b>Memory refs:</b> {session.memoryReferences.join(', ') || 'None'}</p><details><summary>Replay logs</summary>{session.logs.map((log) => <p key={log.id}>{log.category}: {log.message}</p>)}</details></article>) : <Empty title="No sessions yet" body="Run an action to create a replayable execution session." />}</section>;
}

function Agents({ agents, tools }) {
  return <div className="grid two"><section className="card"><h2><Bot size={20} /> Specialized agents</h2>{agents.map((agent) => <article className="timeline-item" key={agent.id}><b>{agent.name}</b><p>{agent.strategy}</p><span>Scope: {agent.scope} · Tools: {agent.tools.join(', ')}</span></article>)}</section><section className="card"><h2><Database size={20} /> MCP-compatible tool registry</h2>{tools.map((tool) => <article className="timeline-item" key={tool.name}><b>{tool.name}</b><p>{tool.description}</p><span>{tool.permissions.join(', ')}</span></article>)}</section></div>;
}

function SettingsPanel() {
  return <div className="grid two"><section className="card"><h2><Shield size={20} /> Security controls</h2><ul><li>API key protection and RBAC-ready service boundaries</li><li>Scoped tool permissions and audit log</li><li>Session isolation and execution replay boundaries</li><li>Environment-driven secrets and service configuration</li></ul></section><section className="card"><h2>Infrastructure adapters</h2><ul><li>PostgreSQL + pgvector schema</li><li>Neo4j graph schema</li><li>Redis queue/session orchestration</li><li>Docker Compose for local production parity</li></ul></section></div>;
}

function VersionPanel({ versions }) {
  return <section className="card"><h2><Brain size={20} /> Versioned memory states</h2>{versions.map((version) => <article className="timeline-item version" key={version.id}><b>{version.id}</b><p>{version.summary}</p><span>{version.nodeCount} nodes · {version.edgeCount} edges · confidence {Math.round(version.confidence * 100)}% · parent {version.parentId || 'root'}</span></article>)}</section>;
}

function LogPanel({ logs }) {
  return <section className="card log-panel"><h2>Audit trail</h2>{logs.slice(0, 18).map((log) => <article key={log.id}><span>{log.category}</span><p>{log.message}</p><time>{new Date(log.timestamp).toLocaleTimeString()}</time></article>)}</section>;
}
function TabBar({ tabs, active, onChange }) { return <div className="sub-tabs">{tabs.map((tab) => <button className={active === tab ? 'active' : ''} onClick={() => onChange(tab)} key={tab}>{tab}</button>)}</div>; }
function Empty({ title, body }) { return <section className="card"><h2>{title}</h2><p>{body}</p></section>; }

createRoot(document.getElementById('root')).render(<App />);
