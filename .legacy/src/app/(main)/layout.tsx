"use client";

import { useState, useCallback, useEffect, useMemo, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { api } from "@/lib/client/api/client";
import { useSessions } from "@/hooks/useSessions";
import { useSettings } from "@/hooks/useSettings";
import { useModels } from "@/hooks/useModels";
import type { AvailableProviders, ModelConfig } from "@/types";

interface MainContextType {
  selectedModel: string;
  availableProviders?: AvailableProviders;
  settings: ReturnType<typeof useSettings>["settings"];
  models: ModelConfig[];
  getModelConfig: (id: string) => ModelConfig | undefined;
  sidebarCollapsed: boolean;
  setSelectedModel: (model: string) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  handleNewChat: (agentConfigId?: string) => Promise<void>;
}

const MainContext = createContext<MainContextType | null>(null);

export function useMainContext() {
  const context = useContext(MainContext);
  if (!context) {
    throw new Error("useMainContext must be used within MainLayout");
  }
  return context;
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { settings } = useSettings();
  const { models, defaultModel, getModelConfig } = useModels();
  const [selectedModel, setSelectedModel] = useState("");
  const [availableProviders, setAvailableProviders] = useState<AvailableProviders>();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const {
    sessions,
    createSession,
    deleteSession,
    pinSession,
  } = useSessions();

  // Resolve selected model: user selection wins, then fallback
  const resolvedModel = useMemo(() => {
    if (models.length === 0) return selectedModel;

    // User-selected model takes priority
    if (selectedModel) return selectedModel;

    // Fallback: first available model
    const enabledSet = settings?.enabledModels?.length ? new Set(settings.enabledModels) : null;
    const firstAvailable = enabledSet
      ? models.find(m => enabledSet.has(m.id))
      : models[0];
    return firstAvailable?.id ?? defaultModel?.id ?? "";
  }, [models, settings, defaultModel, selectedModel]);

  useEffect(() => {
    async function fetchProviders() {
      try {
        const providers = await api.request<AvailableProviders>("/api/providers");
        setAvailableProviders(providers);
      } catch (error) {
        console.error("[App] Failed to fetch available providers:", error);
      }
    }
    fetchProviders();
  }, []);

  const handleNewChat = useCallback(async (agentConfigId?: string) => {
    const newSession = await createSession(undefined, agentConfigId);
    if (newSession) {
      router.push(`/chat/${newSession.id}`);
    }
  }, [createSession, router]);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      await deleteSession(id);
      // If we're viewing the deleted session, navigate away
      if (pathname?.startsWith(`/chat/${id}`)) {
        const remaining = sessions.filter((s) => s.id !== id);
        router.push(remaining.length > 0 ? `/chat/${remaining[0].id}` : "/dashboard");
      }
    },
    [deleteSession, pathname, sessions, router]
  );

  const handlePinSession = useCallback(
    async (id: string) => {
      const session = sessions.find((s) => s.id === id);
      if (session) {
        await pinSession(id, !session.isPinned);
      }
    },
    [sessions, pinSession]
  );

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+N (Mac) / Ctrl+N (Windows/Linux) → New chat
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        handleNewChat();
      }

      // Escape → Focus prompt input (only on chat page)
      if (e.key === "Escape" && pathname?.startsWith("/chat/")) {
        const textarea = document.querySelector<HTMLTextAreaElement>('textarea[name="message"]');
        if (textarea && document.activeElement !== textarea) {
          e.preventDefault();
          textarea.focus();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNewChat, pathname, router]);

  const contextValue: MainContextType = {
    selectedModel: resolvedModel,
    availableProviders,
    settings,
    models,
    getModelConfig,
    sidebarCollapsed,
    setSelectedModel,
    setSidebarCollapsed,
    handleNewChat,
  };

  return (
    <AuthGuard>
      <MainContext.Provider value={contextValue}>
        <div className="h-screen bg-background flex flex-col">
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <Sidebar
              sessions={sessions}
              onNewChat={handleNewChat}
              onDeleteSession={handleDeleteSession}
              onPinSession={handlePinSession}
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col bg-background overflow-hidden">
              {children}
            </main>
          </div>
        </div>
      </MainContext.Provider>
    </AuthGuard>
  );
}
