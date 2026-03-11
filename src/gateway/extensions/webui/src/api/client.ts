import type { ChatResponse, HistoryResponse } from "./types";

const BASE_URL: string =
  import.meta.env.VITE_API_URL ?? "";

let apiKey: string | null = null;

export function setApiKey(key: string | null): void {
  apiKey = key;
}

export function getApiKey(): string | null {
  return apiKey;
}

let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(cb: (() => void) | null): void {
  onUnauthorized = cb;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401) {
      apiKey = null;
      localStorage.removeItem("lucy-api-key");
      onUnauthorized?.();
      throw new Error("Unauthorized");
    }

    let message = res.statusText;
    try {
      const body = await res.json();
      if (body.error) message = body.error;
    } catch {
      // ignore parse failures
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export function getHistory(hideToolCalls?: boolean): Promise<HistoryResponse> {
  const params = hideToolCalls ? "?hideToolCalls=true" : "";
  return request<HistoryResponse>(`/api/chat/history${params}`);
}

export function sendMessage(message: string): Promise<ChatResponse> {
  return request<ChatResponse>("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
}
