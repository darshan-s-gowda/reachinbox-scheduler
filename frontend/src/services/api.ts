import type { Email, User } from "../types/email";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

let csrfToken: string | null = null;

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${API}/api/auth/csrf`, { credentials: "include" });
  if (!response.ok) throw new Error("Unable to initialize secure session");
  const data = await response.json() as { token: string };
  csrfToken = data.token;
  return csrfToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const csrf = method === "GET" || method === "HEAD" ? null : await getCsrfToken();
  const response = await fetch(`${API}${path}`, { ...options, credentials: "include", headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}), ...(options.headers ?? {}) } });
  if (!response.ok) {
    const data = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(data.message ?? "Request failed");
  }
  return response.json();
}

export const api = {
  me: () => request<User>("/api/auth/me"),
  logout: () => request<{ok:boolean}>("/api/auth/logout", { method: "POST" }),
  scheduled: () => request<Email[]>("/api/emails/scheduled"),
  sent: () => request<Email[]>("/api/emails/sent"),
  schedule: (payload: unknown) => request<{count:number; emails:Email[]}>("/api/emails/schedule", { method: "POST", body: JSON.stringify(payload) }),
  slackStatus: () => request<{connected:boolean}>("/api/slack/status"),
  slackDisconnect: () => request<{ok:boolean}>("/api/slack/disconnect", { method: "POST" }),
  search: (q: string) => request<Email[]>(`/api/emails/search?q=${encodeURIComponent(q)}`),
  base: API,
};
