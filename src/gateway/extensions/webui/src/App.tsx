import { useCallback, useEffect, useState } from "react";

import { setApiKey, setOnUnauthorized } from "@/api/client";
import { ChatPanel } from "@/components/ChatPanel";
import { LoginScreen } from "@/components/LoginScreen";

export function App() {
  const [authenticated, setAuthenticated] = useState(() => {
    const stored = localStorage.getItem("lucy-api-key");
    if (stored) {
      setApiKey(stored);
      return true;
    }
    return false;
  });

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
          <button
            onClick={handleLogout}
            className="ml-auto font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            disconnect
          </button>
        )}
      </header>
      {authenticated ? <ChatPanel /> : <LoginScreen onLogin={() => setAuthenticated(true)} />}
    </div>
  );
}
