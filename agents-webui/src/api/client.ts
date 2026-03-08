import type { ChatResponse, HistoryResponse, ModelsResponse } from "./types";

const BASE_URL: string =
  import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body.error) message = body.error;
    } catch {
      // ignore parse failures — fall back to statusText
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export function getHistory(): Promise<HistoryResponse> {
  return request<HistoryResponse>("/api/chat/history");
}

export function sendMessage(
  message: string,
  options?: { modelId?: string; thinkingEnabled?: boolean },
): Promise<ChatResponse> {
  return request<ChatResponse>("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, ...options }),
  });
}

export function getModels(): Promise<ModelsResponse> {
  return request<ModelsResponse>("/api/models");
}
