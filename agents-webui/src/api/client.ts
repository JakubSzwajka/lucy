import type {
  ChatResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  ItemsResponse,
  SessionDetailResponse,
  SessionListResponse,
} from "./types";

const BASE_URL: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:3080";

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

export function listSessions(): Promise<SessionListResponse> {
  return request<SessionListResponse>("/sessions");
}

export function createSession(
  opts?: CreateSessionRequest,
): Promise<CreateSessionResponse> {
  return request<CreateSessionResponse>("/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
}

export function getSession(id: string): Promise<SessionDetailResponse> {
  return request<SessionDetailResponse>(`/sessions/${id}`);
}

export function getSessionItems(id: string): Promise<ItemsResponse> {
  return request<ItemsResponse>(`/sessions/${id}/items`);
}

export function sendMessage(
  sessionId: string,
  message: string,
  modelId?: string,
): Promise<ChatResponse> {
  return request<ChatResponse>("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, message, modelId }),
  });
}
