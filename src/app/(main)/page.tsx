"use client";

import { ChatContainer } from "@/components/chat";
import { useMainContext } from "./layout";

export default function ChatPage() {
  const {
    activeSessionId,
    selectedModel,
    setSelectedModel,
    availableProviders,
    settings,
    handleNewChat,
  } = useMainContext();

  if (!activeSessionId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted">
        <div className="text-center">
          <span className="label block mb-2">{"// INIT.SEQUENCE"}</span>
          <h2 className="text-xl font-medium mb-2 tracking-tight">Welcome to Lucy</h2>
          <p className="text-sm text-muted-dark mb-6">Create a new session to get started.</p>
          <button
            onClick={() => handleNewChat()}
            className="btn-ship"
          >
            New Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <ChatContainer
      sessionId={activeSessionId}
      selectedModel={selectedModel}
      onModelChange={setSelectedModel}
      availableProviders={availableProviders}
      enabledModels={settings?.enabledModels}
    />
  );
}
