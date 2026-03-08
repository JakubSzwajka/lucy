import { ChatPanel } from "@/components/ChatPanel";

export function App() {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <span className="font-mono text-sm font-medium tracking-tight bg-gradient-to-br from-foreground to-[hsl(73,76%,59%)] bg-clip-text text-transparent">
          lucy
        </span>
        <span className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
          webui
        </span>
      </header>
      <ChatPanel />
    </div>
  );
}
