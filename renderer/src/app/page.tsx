"use client";

import { useState, useCallback, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { ChatContainer } from "@/components/chat";
import { SettingsModal } from "@/components/settings";
import { useConversations } from "@/hooks/useConversations";
import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_MODEL, AVAILABLE_MODELS } from "@/lib/ai/models";
import type { AvailableProviders } from "@/types";

export default function Home() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
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
    conversations,
    createConversation,
    deleteConversation,
  } = useConversations();

  // Select first conversation on load if available
  useEffect(() => {
    if (conversations.length > 0 && !activeConversationId) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  const handleNewChat = useCallback(async () => {
    const newConversation = await createConversation();
    if (newConversation) {
      setActiveConversationId(newConversation.id);
    }
  }, [createConversation]);

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      const success = await deleteConversation(id);
      if (success && activeConversationId === id) {
        // Select another conversation or null
        const remaining = conversations.filter((c) => c.id !== id);
        setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
      }
    },
    [deleteConversation, activeConversationId, conversations]
  );

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
  }, []);

  return (
    <div className="h-screen bg-background p-5">
      <div className="flex w-full h-[calc(100vh-40px)] border border-border overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onNewChat={handleNewChat}
          onDeleteConversation={handleDeleteConversation}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col bg-background">
          {activeConversationId ? (
            <ChatContainer
              conversationId={activeConversationId}
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
                <p className="text-sm text-muted-dark mb-6">Create a new thread to get started.</p>
                <button
                  onClick={handleNewChat}
                  className="btn-ship"
                >
                  New Thread
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
