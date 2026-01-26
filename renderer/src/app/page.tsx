"use client";

import { useState, useCallback, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { ChatContainer } from "@/components/chat";
import { SettingsModal } from "@/components/settings";
import { useSessions } from "@/hooks/useSessions";
import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_MODEL, AVAILABLE_MODELS } from "@/lib/ai/models";
import type { AvailableProviders, Session } from "@/types";

export default function Home() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL.id);
  const [availableProviders, setAvailableProviders] = useState<AvailableProviders>();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { settings } = useSettings();

  // Apply default model from settings when settings load
  useEffect(() => {
    if (settings?.defaultModelId) {
      setSelectedModel(settings.defaultModelId);
    }
  }, [settings?.defaultModelId]);

  useEffect(() => {
    async function fetchProviders() {
      try {
        const response = await fetch("/api/providers");
        if (response.ok) {
          const providers: AvailableProviders = await response.json();
          setAvailableProviders(providers);

          // If current selected model's provider is unavailable, select first available model
          const currentModel = AVAILABLE_MODELS.find(m => m.id === selectedModel);
          if (currentModel && !providers[currentModel.provider]) {
            const firstAvailable = AVAILABLE_MODELS.find(m => providers[m.provider]);
            if (firstAvailable) {
              setSelectedModel(firstAvailable.id);
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch available providers:", error);
      }
    }
    fetchProviders();
  }, []);

  const {
    sessions,
    createSession,
    deleteSession,
  } = useSessions();

  // Fetch session details to get root agent when session changes
  useEffect(() => {
    async function fetchSessionDetails() {
      if (activeSessionId) {
        try {
          const response = await fetch(`/api/sessions/${activeSessionId}`);
          if (response.ok) {
            const session = await response.json();
            // Set the root agent as active
            if (session.rootAgentId) {
              setActiveAgentId(session.rootAgentId);
            } else if (session.agents && session.agents.length > 0) {
              // Fallback to first agent if no root agent set
              setActiveAgentId(session.agents[0].id);
            }
          }
        } catch (error) {
          console.error("Failed to fetch session details:", error);
        }
      } else {
        setActiveAgentId(null);
      }
    }
    fetchSessionDetails();
  }, [activeSessionId]);

  // Select first session on load if available
  useEffect(() => {
    if (sessions.length > 0 && !activeSessionId) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  const handleNewChat = useCallback(async () => {
    const newSession = await createSession();
    if (newSession) {
      setActiveSessionId(newSession.id);
      // The root agent ID will be set via the useEffect above
    }
  }, [createSession]);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      const success = await deleteSession(id);
      if (success && activeSessionId === id) {
        // Select another session or null
        const remaining = sessions.filter((s) => s.id !== id);
        setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
        setActiveAgentId(null);
      }
    },
    [deleteSession, activeSessionId, sessions]
  );

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  return (
    <div className="h-screen bg-background p-5">
      <div className="flex w-full h-[calc(100vh-40px)] border border-border overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col bg-background">
          {activeSessionId && activeAgentId ? (
            <ChatContainer
              sessionId={activeSessionId}
              agentId={activeAgentId}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              availableProviders={availableProviders}
              enabledModels={settings?.enabledModels}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted">
              <div className="text-center">
                <span className="label block mb-2">// INIT.SEQUENCE</span>
                <h2 className="text-xl font-medium mb-2 tracking-tight">Welcome to Lucy</h2>
                <p className="text-sm text-muted-dark mb-6">Create a new session to get started.</p>
                <button
                  onClick={handleNewChat}
                  className="btn-ship"
                >
                  New Session
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        availableProviders={availableProviders}
      />
    </div>
  );
}
