"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  clearToken,
  deleteKbDoc,
  getAgent,
  isLoggedIn,
  listKbDocs,
  resetAgentSystemPrompt,
  testChat,
  toggleKbDoc,
  updateAgentSystemPrompt,
  uploadKbDoc,
} from "../../../lib/api";

export default function AgentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.id;

  const [agent, setAgent] = useState(null);
  const [error, setError] = useState(null);
  // Bumped every time Configuration is saved (or reset). TestChatPanel
  // watches this to start a fresh test session and prompt a re-test —
  // the agent's behavior just changed, so a stale chat history would be
  // testing against the OLD persona and giving misleading results.
  const [saveVersion, setSaveVersion] = useState(0);

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
    <div className="page agent-detail-page">
      <div className="topbar">
        <div>
          <button className="btn-link" onClick={() => router.push("/agents")}>
            ← All agents
          </button>
          <h1 style={{ marginTop: 8 }}>{agent.name}</h1>
          <div className="sub">slug: {agent.slug}</div>
        </div>
      </div>

      <div className="agent-layout">
        <div className="agent-layout-left">
          <ConfigPanel
            agent={agent}
            onSaved={() => {
              refresh();
              setSaveVersion((v) => v + 1);
            }}
          />
          <KnowledgeBasePanel agentId={agentId} />
        </div>
        <div className="agent-layout-right">
          <TestChatPanel agentId={agentId} saveVersion={saveVersion} />
        </div>
      </div>
    </div>
  );
}

function ConfigPanel({ agent, onSaved }) {
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  const dirty = systemPrompt !== agent.system_prompt;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateAgentSystemPrompt(agent.id, systemPrompt);
      setSavedAt(new Date());
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm("Revert this agent's playbook to its hardcoded default?")) return;
    setResetting(true);
    setError(null);
    try {
      const res = await resetAgentSystemPrompt(agent.id);
      setSystemPrompt(res.system_prompt);
      setSavedAt(new Date());
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="card">
      <h2>Configuration</h2>
      {error && <div className="error-box">{error}</div>}

      <label>Name</label>
      <div className="readonly-field">{agent.name}</div>

      <label>Description</label>
      <div className="readonly-field">{agent.description || "—"}</div>

      <label>Playbook</label>
      <textarea rows={14} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />

      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button className="btn-secondary" onClick={handleReset} disabled={resetting || saving}>
          {resetting ? "Resetting…" : "Reset to default"}
        </button>
        {!dirty && savedAt && <span className="saved-tag">Saved — takes effect on the next message</span>}
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

// The agents reply with lightweight markdown — **bold** for class names,
// and "• " as an inline bullet separator between schedule items, all
// inside one plain string with no real newlines (see RULES/prompts in
// common/config.py). Dumped as raw text, "**Hurricane**" and "•" show up
// literally instead of rendering — this turns that into actual bold text
// and a real bullet list. Deliberately NOT a markdown library: the output
// only ever uses these two constructs, so a full parser is more than
// this needs.
function renderMessageContent(text) {
  const paragraphs = text.split(/\n+/).filter(Boolean);
  return paragraphs.map((para, pi) => {
    const bulletParts = para
      .split(/\s*•\s*/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (bulletParts.length > 1) {
      const [intro, ...items] = bulletParts;
      return (
        <div key={pi}>
          {intro && <div>{renderBold(intro)}</div>}
          <ul className="chat-bullets">
            {items.map((item, i) => (
              <li key={i}>{renderBold(item)}</li>
            ))}
          </ul>
        </div>
      );
    }
    return <div key={pi}>{renderBold(para)}</div>;
  });
}

function renderBold(text) {
  const segments = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return segments.map((seg, i) =>
    seg.startsWith("**") && seg.endsWith("**") ? (
      <strong key={i}>{seg.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{seg}</span>
    )
  );
}

function TestChatPanel({ agentId, saveVersion }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  // Session id returned by the backend on the first message of a test
  // conversation, sent back on every message after that — without this,
  // every message would land in a brand-new session and multi-turn
  // flows (like the booking confirmation "yes/no") could never work.
  const [sessionId, setSessionId] = useState(null);
  // True right after a config save, until the next message is actually
  // sent — drives the banner + pulsing Send button below.
  const [needsRetest, setNeedsRetest] = useState(false);
  const isFirstRender = useRef(true);
  const chatLogRef = useRef(null);

  // Config was just saved (or reset): the agent's behavior changed
  // mid-conversation, so the old chat history and session are now
  // testing a persona that no longer exists. Start clean and prompt
  // the admin to actually verify the change, rather than silently
  // leaving a stale conversation sitting there.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setMessages([]);
    setSessionId(null);
    setNeedsRetest(true);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveVersion]);

  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setSending(true);
    try {
      const res = await testChat(agentId, text, sessionId);
      setSessionId(res.session_id);
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
      setNeedsRetest(false);
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
    <div className="card chat-panel">
      <h2>Test chat</h2>
      <div className="sub" style={{ marginBottom: 12 }}>
        Uses a throwaway conversation thread — it never touches real member or staff chat history.
      </div>
      {needsRetest && (
        <div className="retest-banner">
          Settings were saved — this started a fresh test session. Send a message to verify the update.
        </div>
      )}
      {error && <div className="error-box">{error}</div>}

      <div className="chat-log" ref={chatLogRef}>
        {messages.length === 0 ? (
          <div className="empty-state">Send a message to start a test conversation.</div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role}`}>
              {m.role === "assistant" ? renderMessageContent(m.content) : m.content}
            </div>
          ))
        )}
      </div>

      <div className="row chat-input-row">
        <input
          type="text"
          placeholder="Type a test message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        <button
          className={`btn${needsRetest ? " pulse" : ""}`}
          onClick={handleSend}
          disabled={sending || !input.trim()}
        >
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}