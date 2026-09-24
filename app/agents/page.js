"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, isLoggedIn, listAgents } from "../../lib/api";

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState(null);
  const [error, setError] = useState(null);

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
    <div className="agents-page-wrap">
      <div className="page">
        <div className="topbar-brand-row">
          <img src="/logo.png" alt="Reset Fitness" className="topbar-logo" />
          <div className="row">
            <button className="btn-link" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
         <div className="agents-heading">
          <h1>Reset Agent Garden</h1>
          <div className="sub">
            Each agent has its own playbook, knowledge base, and model.
            {agents && (
              <>
                {" "}
                · {agents.length} agent{agents.length === 1 ? "" : "s"}
              </>
            )}
          </div>
        </div>

       

        {error && <div className="error-box">{error}</div>}

        {agents === null && !error ? (
          <div className="spinner-text">Loading agents…</div>
        ) : (
          <div className="agent-grid">
            {agents?.map((agent) => {
              const comingSoon = agent.slug === "pfc";
              return (
                <div
                  key={agent.id}
                  className={`agent-tile${comingSoon ? " coming-soon" : ""}`}
                  onClick={() => !comingSoon && router.push(`/agents/${agent.id}`)}
                >
                  <div className="agent-tile-top">
                    <div className="agent-avatar">{agent.name.charAt(0)}</div>
                    {comingSoon ? (
                      <span className="model-badge coming-soon-badge">Coming soon</span>
                    ) : (
                      <span className="model-badge">{agent.active_model}</span>
                    )}
                  </div>
                  <div className="slug">{agent.slug}</div>
                  <h3>{agent.name}</h3>
                  <div className="desc">{agent.description || "No description."}</div>
                  {!comingSoon && <div className="agent-tile-cta">Open agent →</div>}
                </div>
              );
            })}
            <div className="agent-tile coming-soon">
              <div className="agent-tile-top">
                <div className="agent-avatar">W</div>
                <span className="model-badge coming-soon-badge">Coming soon</span>
              </div>
              <div className="slug">whatsapp</div>
              <h3>WhatsApp Agent</h3>
              <div className="desc">Helps Reset Fitness members book classes and get support over WhatsApp.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
