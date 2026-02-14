import type { AgentConfigWithTools, AgentConfigCreate, AgentConfigUpdate } from "@/types";

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

  // Memory extraction
  async extractMemories(sessionId: string, model?: { provider: string; modelId: string }) {
    return this.request<{
      memories: Array<{
        type: string;
        content: string;
        confidenceScore: number;
        confidenceLevel: string;
        evidence: string;
        tags: string[];
        existingMemoryId?: string;
        suggestedConnections?: Array<{ existingMemoryId: string; relationshipType: string }>;
      }>;
      questions: Array<{
        content: string;
        context: string;
        curiosityType: string;
        curiosityScore: number;
        timing: string;
        sourceMemoryIndices: number[];
      }>;
      metadata: {
        sessionId: string;
        messagesAnalyzed: number;
        modelUsed: string;
        durationMs: number;
      };
    }>("/api/memories/extract", {
      method: "POST",
      body: JSON.stringify({ sessionId, model }),
    });
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

  async confirmExtraction(input: {
    sessionId: string;
    approvedMemories: Array<{
      type: string;
      content: string;
      confidenceScore: number;
      confidenceLevel: string;
      evidence: string;
      tags: string[];
      existingMemoryId?: string;
      approved: boolean;
      edited?: Record<string, unknown>;
    }>;
    approvedQuestions: Array<{
      content: string;
      context: string;
      curiosityType: string;
      curiosityScore: number;
      timing: string;
      sourceMemoryIndices: number[];
      approved: boolean;
    }>;
  }) {
    return this.request<{
      memoriesSaved: number;
      questionsGenerated: number;
      reflection: Record<string, unknown>;
    }>("/api/memories/extract/confirm", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
}

export const api = new APIClient(BASE_URL);
export { BASE_URL as API_BASE_URL };
