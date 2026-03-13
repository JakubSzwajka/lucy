import { useCallback, useEffect, useState } from "react";

import { setApiKey, setOnUnauthorized } from "@/api/client";
import { ChatPanel } from "@/components/ChatPanel";
import { LoginScreen } from "@/components/LoginScreen";
import { TaskBoard } from "@/components/TaskBoard";

type View = "chat" | "tasks";

export function App() {
  const [authenticated, setAuthenticated] = useState(() => {
    const stored = localStorage.getItem("lucy-api-key");
    if (stored) {
      setApiKey(stored);
      return true;
    }
    return false;
  });

  const [view, setView] = useState<View>("chat");

  const handleLogout = useCallback(() => {
    localStorage.removeItem("lucy-api-key");
    setApiKey(null);
    setAuthenticated(false);
  }, []);

  useEffect(() => {
    setOnUnauthorized(handleLogout);
    return () => setOnUnauthorized(null);
  }, [handleLogout]);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <a href="/" className="font-mono text-sm font-medium tracking-tight bg-gradient-to-br from-foreground to-[hsl(73,76%,59%)] bg-clip-text text-transparent hover:opacity-80 transition-opacity">
          lucy
        </a>

        {authenticated && (
          <nav className="flex items-center gap-1 ml-4">
            <button
              onClick={() => setView("chat")}
              className={`font-mono text-xs px-2 py-1 rounded transition-colors ${
                view === "chat"
                  ? "text-foreground bg-secondary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              chat
            </button>
            <button
              onClick={() => setView("tasks")}
              className={`font-mono text-xs px-2 py-1 rounded transition-colors ${
                view === "tasks"
                  ? "text-foreground bg-secondary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              tasks
            </button>
          </nav>
        )}

        {authenticated && (
          <button
            onClick={handleLogout}
            className="ml-auto font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            disconnect
          </button>
        )}
      </header>
      {authenticated ? (
        view === "chat" ? <ChatPanel /> : <TaskBoard />
      ) : (
        <LoginScreen onLogin={() => setAuthenticated(true)} />
      )}
    </div>
  );
}
