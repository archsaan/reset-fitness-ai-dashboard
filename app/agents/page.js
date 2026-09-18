"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, createAgent, isLoggedIn, listAgents } from "../../lib/api";

// Keep in sync with AVAILABLE_MODELS in app/core/config.py on the backend.
const AVAILABLE_MODELS = ["claude-haiku-4-5-20251001", "claude-sonnet-4-5"];

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState(null);
  const [error, setError] = useState(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    refresh();
  }, [router]);

  function refresh() {
    setError(null);
    listAgents()
      .then(setAgents)
      .catch((err) => {
        if (err.status === 401) {
          clearToken();
          router.replace("/login");
        } else {
          setError(err.message);
        }
      });
  }

  function handleLogout() {
    clearToken();
    router.replace("/login");
  }

  return (
    <div className="page">
      <div className="topbar">
        <div>
          <h1>Reset Fitness — Agents</h1>
          <div className="sub">
            Each agent has its own system prompt, knowledge base, and model.
            {agents && (
              <>
                {" "}
                · {agents.length} agent{agents.length === 1 ? "" : "s"}
              </>
            )}
          </div>
        </div>
        <div className="row">
          <button className="btn-link" onClick={handleLogout}>
            Log out
          </button>
          <button className="btn" onClick={() => setShowNew(true)}>
            + Create agent
          </button>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {agents === null && !error ? (
        <div className="spinner-text">Loading agents…</div>
      ) : (
        <div className="agent-grid">
          {agents?.map((agent) => (
            <div
              key={agent.id}
              className="agent-tile"
              onClick={() => router.push(`/agents/${agent.id}`)}
            >
              <div className="slug">{agent.slug}</div>
              <h3>{agent.name}</h3>
              <div className="desc">{agent.description || "No description."}</div>
              <span className="model-badge">{agent.active_model}</span>
            </div>
          ))}
          <div className="agent-tile new-tile" onClick={() => setShowNew(true)}>
            + New agent
          </div>
        </div>
      )}

      {showNew && (
        <NewAgentModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false);
            router.push(`/agents/${id}`);
          }}
        />
      )}
    </div>
  );
}

function NewAgentModal({ onClose, onCreated }) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [activeModel, setActiveModel] = useState(AVAILABLE_MODELS[0]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!slug.trim() || !name.trim() || !systemPrompt.trim()) {
      setError("Slug, name, and system prompt are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await createAgent({
        slug: slug.trim(),
        name: name.trim(),
        description: description.trim(),
        system_prompt: systemPrompt,
        active_model: activeModel,
      });
      onCreated(res.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div className="card" style={{ width: 480, maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <h2>New agent</h2>
        {error && <div className="error-box">{error}</div>}

        <label>Slug (used in /chat requests, not editable later)</label>
        <input type="text" placeholder="e.g. front-desk" value={slug} onChange={(e) => setSlug(e.target.value)} />

        <label>Name</label>
        <input type="text" placeholder="e.g. Front Desk Agent" value={name} onChange={(e) => setName(e.target.value)} />

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
        <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />

        <div className="row" style={{ marginTop: 20, justifyContent: "flex-end" }}>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={handleCreate} disabled={saving}>
            {saving ? "Creating…" : "Create agent"}
          </button>
        </div>
      </div>
    </div>
  );
}
