/**
 * Thin fetch wrapper for the FastAPI backend. Every admin call attaches
 * the mock admin token from localStorage as the `authorization` header
 * (swap the login flow for real auth later — this file's callers don't
 * need to change, only login()'s implementation would).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export class ApiError extends Error {
  constructor(status, detail) {
    super(typeof detail === "string" ? detail : JSON.stringify(detail));
    this.status = status;
    this.detail = detail;
  }
}

function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("admin_token");
}

export function setToken(token) {
  window.localStorage.setItem("admin_token", token);
}

export function clearToken() {
  window.localStorage.removeItem("admin_token");
}

export function isLoggedIn() {
  return !!getToken();
}

async function request(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers["authorization"] = `Bearer ${token}`;
  if (!isForm && body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no body / not JSON — fine for some responses
  }

  if (!res.ok) {
    throw new ApiError(res.status, data?.detail || res.statusText);
  }
  return data;
}

// --- Auth ---
export function login(username, password) {
  return request("/admin/login", { method: "POST", body: { username, password } });
}

// --- Agents ---
export function listAgents() {
  return request("/admin/agents");
}

export function getAgent(agentId) {
  return request(`/admin/agents/${agentId}`);
}

export function createAgent(payload) {
  return request("/admin/agents", { method: "POST", body: payload });
}

export function updateAgent(agentId, payload) {
  return request(`/admin/agents/${agentId}`, { method: "PUT", body: payload });
}

export function deleteAgent(agentId) {
  return request(`/admin/agents/${agentId}`, { method: "DELETE" });
}

// --- Knowledge base (scoped to an agent) ---
export function listKbDocs(agentId) {
  return request(`/admin/agents/${agentId}/knowledge-base`);
}

export function uploadKbDoc(agentId, file) {
  const form = new FormData();
  form.append("file", file);
  return request(`/admin/agents/${agentId}/knowledge-base`, {
    method: "POST",
    body: form,
    isForm: true,
  });
}

export function toggleKbDoc(agentId, docId) {
  return request(`/admin/agents/${agentId}/knowledge-base/${docId}/toggle`, { method: "PUT" });
}

export function deleteKbDoc(agentId, docId) {
  return request(`/admin/agents/${agentId}/knowledge-base/${docId}`, { method: "DELETE" });
}

// --- Usage ---
export function getGlobalUsage() {
  return request("/admin/usage");
}

export function getAgentUsage(agentId) {
  return request(`/admin/agents/${agentId}/usage`);
}

// --- Test chat ---
export function testChat(agentId, message) {
  return request(`/admin/agents/${agentId}/test-chat`, { method: "POST", body: { message } });
}
