import { ChatPanel } from "@/components/ChatPanel";

export function App() {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border px-4 py-3">
        <h1 className="text-sm font-semibold tracking-tight">Agents WebUI</h1>
      </header>
      <ChatPanel />
    </div>
  );
}
