import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bot, Brain, MessageSquare, Network, Play, Upload } from 'lucide-react';
import './styles.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5050/api';

// Fetch helper keeps API calls consistent and throws readable errors for the log panel.
async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

// App coordinates tab state, API state, and user-triggered agent operations.
function App() {
  const [mainTab, setMainTab] = useState('Knowledge');
  const [knowledgeTab, setKnowledgeTab] = useState('Graph');
  const [actionTab, setActionTab] = useState('Act');
  const [graphState, setGraphState] = useState({ nodes: [], edges: [], logs: [], memoryInsights: [], sampleImages: [] });
  const [chatHistory, setChatHistory] = useState([]);
  const [chatQuery, setChatQuery] = useState('');
  const [enhanceForm, setEnhanceForm] = useState({ title: '', content: '', imageAlt: '' });
  const [lastAction, setLastAction] = useState(null);

  // Load seeded graph state once the UI mounts.
  useEffect(() => {
    api('/graph').then(setGraphState).catch((error) => console.error(error));
  }, []);

  // Type counts summarize graph memory for the header chips.
  const typeCounts = useMemo(() => {
    return graphState.nodes.reduce((counts, node) => {
      counts[node.type] = (counts[node.type] || 0) + 1;
      return counts;
    }, {});
  }, [graphState.nodes]);

  // Sends new onboarding text and optional image notes to the graph service.
  async function submitEnhancement(event) {
    event.preventDefault();
    const state = await api('/enhance', { method: 'POST', body: JSON.stringify(enhanceForm) });
    setGraphState(state);
    setEnhanceForm({ title: '', content: '', imageAlt: '' });
  }

  // Runs one agent action iteration and refreshes graph memory with the result.
  async function runActionLoop() {
    const result = await api('/act', { method: 'POST' });
    setLastAction(result.action);
    setGraphState(result.state);
  }

  // Sends a natural-language query to graph-backed chat and appends the response.
  async function sendChat(event) {
    event.preventDefault();
    const result = await api('/chat', { method: 'POST', body: JSON.stringify({ query: chatQuery }) });
    setChatHistory((history) => [...history, { query: chatQuery, answer: result.answer, matches: result.matches }]);
    setGraphState(result.state);
    setChatQuery('');
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">MERN POC</p>
          <h1>AI-powered onboarding and exploratory QA agent</h1>
          <p>
            Ingest onboarding knowledge, visualize the graph, simulate exploratory testing, and chat with graph-backed memory.
          </p>
        </div>
        <div className="metric-grid">
          {Object.entries(typeCounts).map(([type, count]) => (
            <span className="metric" key={type}>{count} {type}</span>
          ))}
        </div>
      </section>

      <nav className="main-tabs">
        {['Knowledge', 'Action'].map((tab) => (
          <button className={mainTab === tab ? 'active' : ''} onClick={() => setMainTab(tab)} key={tab}>{tab}</button>
        ))}
      </nav>

      {mainTab === 'Knowledge' ? (
        <TabbedPanel tabs={['Graph', 'Memory Insights', 'Enhance']} active={knowledgeTab} onChange={setKnowledgeTab}>
          {knowledgeTab === 'Graph' && <GraphTab state={graphState} />}
          {knowledgeTab === 'Memory Insights' && <MemoryTab insights={graphState.memoryInsights} logs={graphState.logs} />}
          {knowledgeTab === 'Enhance' && <EnhanceTab form={enhanceForm} setForm={setEnhanceForm} onSubmit={submitEnhancement} logs={graphState.logs} />}
        </TabbedPanel>
      ) : (
        <TabbedPanel tabs={['Act', 'Chat']} active={actionTab} onChange={setActionTab}>
          {actionTab === 'Act' && <ActTab onRun={runActionLoop} lastAction={lastAction} logs={graphState.logs} />}
          {actionTab === 'Chat' && <ChatTab query={chatQuery} setQuery={setChatQuery} onSubmit={sendChat} history={chatHistory} logs={graphState.logs} />}
        </TabbedPanel>
      )}
    </main>
  );
}

// TabbedPanel renders shared sub-tab controls for Knowledge and Action areas.
function TabbedPanel({ tabs, active, onChange, children }) {
  return (
    <section className="panel">
      <div className="sub-tabs">
        {tabs.map((tab) => (
          <button className={active === tab ? 'active' : ''} onClick={() => onChange(tab)} key={tab}>{tab}</button>
        ))}
      </div>
      {children}
    </section>
  );
}

// GraphTab presents a lightweight graph visualization and sample UI image cards.
function GraphTab({ state }) {
  return (
    <div className="two-column">
      <section className="card">
        <h2><Network size={20} /> Knowledge graph</h2>
        <div className="graph-canvas">
          {state.nodes.map((node, index) => (
            <article className={`node node-${node.type.toLowerCase()}`} style={{ '--i': index }} key={node.id}>
              <strong>{node.label}</strong>
              <span>{node.type}</span>
            </article>
          ))}
        </div>
      </section>
      <section className="card">
        <h2>Relationships and UI examples</h2>
        <div className="edge-list">
          {state.edges.slice(0, 16).map((edge) => (
            <p key={edge.id}>{edge.source} <b>{edge.relationship}</b> {edge.target}</p>
          ))}
        </div>
        <div className="image-grid">
          {state.sampleImages.map((image) => (
            <figure key={image.id}>
              <img src={image.src} alt={image.alt} />
              <figcaption>{image.title}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}

// MemoryTab shows graph evolution and the underlying detailed log stream.
function MemoryTab({ insights, logs }) {
  return (
    <div className="two-column">
      <section className="card">
        <h2><Brain size={20} /> Memory insights</h2>
        {insights.map((insight) => (
          <article className="timeline-item" key={insight.id}>
            <time>{new Date(insight.timestamp).toLocaleTimeString()}</time>
            <p>{insight.message}</p>
            <span>{insight.graphSize} graph nodes</span>
          </article>
        ))}
      </section>
      <LogPanel logs={logs} />
    </div>
  );
}

// EnhanceTab collects new text and UI-image notes to expand graph knowledge.
function EnhanceTab({ form, setForm, onSubmit, logs }) {
  return (
    <div className="two-column">
      <section className="card">
        <h2><Upload size={20} /> Add onboarding knowledge</h2>
        <form className="stack" onSubmit={onSubmit}>
          <label>Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
          <label>Document text<textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} required rows="7" /></label>
          <label>Optional UI image notes<textarea value={form.imageAlt} onChange={(event) => setForm({ ...form, imageAlt: event.target.value })} rows="4" /></label>
          <button className="primary">Enhance graph</button>
        </form>
      </section>
      <LogPanel logs={logs} />
    </div>
  );
}

// ActTab runs and displays the simulated exploratory testing loop.
function ActTab({ onRun, lastAction, logs }) {
  return (
    <div className="two-column">
      <section className="card action-card">
        <h2><Play size={20} /> Exploratory QA loop</h2>
        <p>The agent selects the next Action node, traces related features, and logs a concrete test idea.</p>
        <button className="primary" onClick={onRun}>Run next action</button>
        {lastAction && <pre>{lastAction.result}</pre>}
      </section>
      <LogPanel logs={logs} />
    </div>
  );
}

// ChatTab supports natural-language graph lookup and displays matched evidence.
function ChatTab({ query, setQuery, onSubmit, history, logs }) {
  return (
    <div className="two-column">
      <section className="card chat-card">
        <h2><MessageSquare size={20} /> Graph chat</h2>
        <form className="chat-form" onSubmit={onSubmit}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ask about login, checkout, defects..." required />
          <button className="primary"><Bot size={16} /> Ask</button>
        </form>
        <div className="chat-history">
          {history.map((item, index) => (
            <article key={`${item.query}-${index}`}>
              <b>You:</b> {item.query}
              <p><b>Agent:</b> {item.answer}</p>
            </article>
          ))}
        </div>
      </section>
      <LogPanel logs={logs} />
    </div>
  );
}

// LogPanel is reused in each tab to satisfy the detailed action logging requirement.
function LogPanel({ logs }) {
  return (
    <section className="card log-panel">
      <h2>Detailed logs</h2>
      {logs.slice(0, 18).map((log) => (
        <article key={log.id}>
          <span>{log.category}</span>
          <p>{log.message}</p>
          <time>{new Date(log.timestamp).toLocaleTimeString()}</time>
        </article>
      ))}
    </section>
  );
}

createRoot(document.getElementById('root')).render(<App />);
