import type { AgentConfigWithTools, AgentConfigCreate, AgentConfigUpdate, Trigger, TriggerWithRuns, TriggerCreate, TriggerUpdate, TriggerRun } from "@/types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const TOKEN_KEY = "lucy_auth_token";

class APIClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }

  private getHeaders(extra?: HeadersInit): Headers {
    const headers = new Headers(extra);
    const token = this.getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return headers;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers = this.getHeaders(options.headers);

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Don't redirect if this is an auth endpoint (login/register) — let the caller handle the error
      const isAuthEndpoint = endpoint.startsWith("/api/auth/");
      if (!isAuthEndpoint) {
        this.clearToken();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Unauthorized");
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Request failed: ${response.status}`);
    }

    if (response.status === 204) return undefined as T;
    return response.json();
  }

  async stream(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseURL}${endpoint}`;
    const headers = this.getHeaders(options.headers);

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.clearToken();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Stream request failed: ${response.status}`);
    }

    return response;
  }

  // Memory CRUD
  async listMemories(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request<Record<string, unknown>[]>(`/api/memories${qs}`);
  }

  async getMemory(id: string) {
    return this.request<Record<string, unknown>>(`/api/memories/${id}`);
  }

  async createMemory(input: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/api/memories", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async updateMemory(id: string, updates: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/api/memories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async deleteMemory(id: string) {
    return this.request<void>(`/api/memories/${id}`, { method: "DELETE" });
  }

  // Questions
  async listQuestions(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request<Record<string, unknown>[]>(`/api/questions${qs}`);
  }

  async resolveQuestion(id: string, answer: string) {
    return this.request<Record<string, unknown>>(`/api/questions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ answer }),
    });
  }

  async deleteQuestion(id: string) {
    return this.request<void>(`/api/questions/${id}`, { method: "DELETE" });
  }

  // Identity
  async getIdentity() {
    return this.request<Record<string, unknown> | null>("/api/identity");
  }

  async generateIdentity() {
    return this.request<Record<string, unknown>>("/api/identity/generate", {
      method: "POST",
    });
  }

  async getIdentityHistory() {
    return this.request<Record<string, unknown>[]>("/api/identity/history");
  }

  // Memory Settings
  async getMemorySettings() {
    return this.request<Record<string, unknown>>("/api/memory-settings");
  }

  async updateMemorySettings(input: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/api/memory-settings", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  // Agent Configs
  async listAgentConfigs() {
    return this.request<AgentConfigWithTools[]>("/api/agent-configs");
  }

  async getAgentConfig(id: string) {
    return this.request<AgentConfigWithTools>(`/api/agent-configs/${id}`);
  }

  async createAgentConfig(input: AgentConfigCreate) {
    return this.request<AgentConfigWithTools>("/api/agent-configs", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async updateAgentConfig(id: string, input: AgentConfigUpdate) {
    return this.request<AgentConfigWithTools>(`/api/agent-configs/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  }

  async deleteAgentConfig(id: string) {
    return this.request<void>(`/api/agent-configs/${id}`, { method: "DELETE" });
  }

  // Triggers
  async listTriggers() {
    return this.request<Trigger[]>("/api/triggers");
  }

  async getTrigger(id: string) {
    return this.request<TriggerWithRuns>(`/api/triggers/${id}`);
  }

  async createTrigger(input: TriggerCreate) {
    return this.request<Trigger>("/api/triggers", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async updateTrigger(id: string, input: TriggerUpdate) {
    return this.request<Trigger>(`/api/triggers/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  }

  async deleteTrigger(id: string) {
    return this.request<void>(`/api/triggers/${id}`, { method: "DELETE" });
  }

  async getTriggerRuns(id: string, limit = 10, offset = 0) {
    return this.request<{ runs: TriggerRun[]; total: number }>(
      `/api/triggers/${id}/runs?limit=${limit}&offset=${offset}`
    );
  }

  async cancelTriggerRun(triggerId: string, runId: string) {
    return this.request<{ success: boolean }>(
      `/api/triggers/${triggerId}/runs/${runId}/cancel`,
      { method: "POST" }
    );
  }

  async testTrigger(id: string) {
    return this.request<{ success: boolean; runId: string; sessionId: string }>(
      `/api/triggers/${id}/test`,
      { method: "POST" }
    );
  }

}

export const api = new APIClient(BASE_URL);
export { BASE_URL as API_BASE_URL };
