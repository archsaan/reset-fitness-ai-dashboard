"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  clearToken,
  deleteAgent,
  deleteKbDoc,
  getAgent,
  getAgentUsage,
  isLoggedIn,
  listKbDocs,
  testChat,
  toggleKbDoc,
  updateAgent,
  uploadKbDoc,
} from "../../../lib/api";

const AVAILABLE_MODELS = ["claude-haiku-4-5-20251001", "claude-sonnet-4-5"];

export default function AgentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.id;

  const [agent, setAgent] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  function refresh() {
    setError(null);
    getAgent(agentId)
      .then(setAgent)
      .catch((err) => {
        if (err.status === 401) {
          clearToken();
          router.replace("/login");
        } else {
          setError(err.message);
        }
      });
  }

  async function handleDeleteAgent() {
    if (!confirm(`Delete "${agent.name}"? This also deletes its knowledge base. This can't be undone.`)) return;
    try {
      await deleteAgent(agentId);
      router.push("/agents");
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) {
    return (
      <div className="page">
        <div className="error-box">{error}</div>
        <button className="btn-link" onClick={() => router.push("/agents")}>
          ← Back to agents
        </button>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="page">
        <div className="spinner-text">Loading…</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="topbar">
        <div>
          <button className="btn-link" onClick={() => router.push("/agents")}>
            ← All agents
          </button>
          <h1 style={{ marginTop: 8 }}>{agent.name}</h1>
          <div className="sub">slug: {agent.slug}</div>
        </div>
        <button className="btn-danger" onClick={handleDeleteAgent}>
          Delete agent
        </button>
      </div>

      <ConfigPanel agent={agent} onSaved={refresh} />
      <KnowledgeBasePanel agentId={agentId} />
      <UsagePanel agentId={agentId} />
      <TestChatPanel agentId={agentId} />
    </div>
  );
}

function ConfigPanel({ agent, onSaved }) {
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description || "");
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt);
  const [activeModel, setActiveModel] = useState(agent.active_model);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  const dirty =
    name !== agent.name ||
    description !== (agent.description || "") ||
    systemPrompt !== agent.system_prompt ||
    activeModel !== agent.active_model;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateAgent(agent.id, {
        name,
        description,
        system_prompt: systemPrompt,
        active_model: activeModel,
      });
      setSavedAt(new Date());
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h2>Configuration</h2>
      {error && <div className="error-box">{error}</div>}

      <label>Name</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} />

      <label>Description</label>
      <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />

      <label>Model</label>
      <select value={activeModel} onChange={(e) => setActiveModel(e.target.value)}>
        {AVAILABLE_MODELS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      <label>System prompt</label>
      <textarea rows={12} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />

      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        {!dirty && savedAt && <span className="saved-tag">Saved</span>}
      </div>
    </div>
  );
}

function KnowledgeBasePanel({ agentId }) {
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  function refresh() {
    listKbDocs(agentId).then(setDocs).catch((err) => setError(err.message));
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await uploadKbDoc(agentId, file);
      if (res.indexed === false) {
        setError(`Uploaded, but indexing failed (it still works via full-KB fallback): ${res.index_error}`);
      }
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleToggle(docId) {
    try {
      await toggleKbDoc(agentId, docId);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(docId, filename) {
    if (!confirm(`Delete "${filename}" from this agent's knowledge base?`)) return;
    try {
      await deleteKbDoc(agentId, docId);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card">
      <h2>Knowledge base</h2>
      {error && <div className="error-box">{error}</div>}

      <div className="row" style={{ marginBottom: 12 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.txt"
          onChange={handleFileChange}
          disabled={uploading}
        />
        {uploading && <span className="spinner-text">Uploading…</span>}
      </div>

      {docs === null ? (
        <div className="spinner-text">Loading…</div>
      ) : docs.length === 0 ? (
        <div className="empty-state">No documents yet. Upload a .md or .txt file above.</div>
      ) : (
        <div>
          {docs.map((doc) => (
            <div className="kb-doc" key={doc.id}>
              <span className={doc.active ? "filename" : "filename inactive"}>{doc.filename}</span>
              <div className="row">
                <span className={`pill ${doc.active ? "active" : "inactive"}`}>
                  {doc.active ? "active" : "inactive"}
                </span>
                <button className="btn-secondary" onClick={() => handleToggle(doc.id)}>
                  {doc.active ? "Deactivate" : "Activate"}
                </button>
                <button className="btn-danger" onClick={() => handleDelete(doc.id, doc.filename)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UsagePanel({ agentId }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAgentUsage(agentId).then(setRows).catch((err) => setError(err.message));
  }, [agentId]);

  return (
    <div className="card">
      <h2>Usage</h2>
      {error && <div className="error-box">{error}</div>}
      {rows === null ? (
        <div className="spinner-text">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="empty-state">No requests logged for this agent yet.</div>
      ) : (
        <table className="usage-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Requests</th>
              <th>Input tokens</th>
              <th>Output tokens</th>
              <th>Est. cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.model}>
                <td>{r.model}</td>
                <td>{r.requests}</td>
                <td>{r.total_input_tokens.toLocaleString()}</td>
                <td>{r.total_output_tokens.toLocaleString()}</td>
                <td>${r.estimated_cost_usd.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function TestChatPanel({ agentId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setSending(true);
    try {
      const res = await testChat(agentId, text);
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="card">
      <h2>Test chat</h2>
      <div className="sub" style={{ marginBottom: 12 }}>
        Uses a throwaway conversation thread — it never touches real member or staff chat history.
      </div>
      {error && <div className="error-box">{error}</div>}

      {messages.length > 0 && (
        <div className="chat-log">
          {messages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role}`}>
              {m.content}
            </div>
          ))}
        </div>
      )}

      <div className="row">
        <input
          type="text"
          placeholder="Type a test message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        <button className="btn" onClick={handleSend} disabled={sending || !input.trim()}>
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
