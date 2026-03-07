import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";

import { createSession, listSessions } from "@/api/client";
import type { SessionSummary } from "@/api/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface SessionListHandle {
  refresh: () => void;
}

interface SessionListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSessionCreated: (id: string) => void;
}

export const SessionList = forwardRef<SessionListHandle, SessionListProps>(
  function SessionList({ selectedId, onSelect, onSessionCreated }, ref) {
    const [sessions, setSessions] = useState<SessionSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    const fetchSessions = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        const { sessions } = await listSessions();
        setSessions(sessions);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load sessions");
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => {
      fetchSessions();
    }, [fetchSessions]);

    useImperativeHandle(ref, () => ({ refresh: fetchSessions }), [fetchSessions]);

    async function handleNewChat() {
      setCreating(true);
      try {
        const { sessionId, agentId } = await createSession();
        const now = new Date().toISOString();
        const newSession: SessionSummary = {
          id: sessionId,
          agentId,
          updatedAt: now,
          agent: { status: "idle", turnCount: 0 },
        };
        setSessions((prev) => [newSession, ...prev]);
        onSessionCreated(sessionId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create session");
      } finally {
        setCreating(false);
      }
    }

    return (
      <div className="flex h-full flex-col font-sans">
        <div className="p-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleNewChat}
            disabled={creating}
          >
            {creating ? "Creating..." : "New Chat"}
          </Button>
        </div>

        {loading ? (
          <div className="p-2 text-sm text-muted-foreground">Loading...</div>
        ) : error ? (
          <div className="p-2 text-sm text-destructive">{error}</div>
        ) : sessions.length === 0 ? (
          <div className="p-2 text-sm text-muted-foreground">No sessions yet</div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-0.5 p-1">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => onSelect(session.id)}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent ${
                    selectedId === session.id ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-foreground">
                      {new Date(session.updatedAt).toLocaleDateString()}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {session.agent.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    );
  },
);
