import type { ChatResponse, HistoryResponse, SessionInfo, StreamEvent, TaskBoard } from "./types";

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

/**
 * Send a message via streaming SSE. Calls `onEvent` for each stream event.
 * Returns a promise that resolves when the stream ends.
 */
export async function sendMessageStream(
  message: string,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const res = await fetch(`${BASE_URL}/api/chat/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    if (res.status === 401) {
      apiKey = null;
      localStorage.removeItem("lucy-api-key");
      onUnauthorized?.();
      throw new Error("Unauthorized");
    }
    throw new Error(res.statusText);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE frames
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data:")) {
        const data = line.slice(5).trim();
        if (!data) continue;
        try {
          const event = JSON.parse(data) as StreamEvent;
          onEvent(event);
        } catch {
          // skip malformed
        }
      }
    }
  }
}

export function getSessionInfo(): Promise<SessionInfo> {
  return request<SessionInfo>("/api/session");
}

export function getTasks(): Promise<TaskBoard> {
  return request<TaskBoard>("/api/tasks");
}
