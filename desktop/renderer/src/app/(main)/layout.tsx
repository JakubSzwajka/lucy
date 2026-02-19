"use client";

import { useState, useCallback, useEffect, useMemo, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { api } from "@/lib/api/client";
import { useSessions } from "@/hooks/useSessions";
import { useSettings } from "@/hooks/useSettings";
import { useModels } from "@/hooks/useModels";
import { useAgentConfigs } from "@/hooks/useAgentConfigs";
import type { AvailableProviders, ModelConfig } from "@/types";

interface MainContextType {
  activeSessionId: string | null;
  selectedModel: string;
  availableProviders?: AvailableProviders;
  settings: ReturnType<typeof useSettings>["settings"];
  models: ModelConfig[];
  getModelConfig: (id: string) => ModelConfig | undefined;
  sidebarCollapsed: boolean;
  setActiveSessionId: (id: string | null) => void;
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
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const { settings } = useSettings();
  const { models, defaultModel, getModelConfig } = useModels();
  const { configs } = useAgentConfigs();

  const [selectedModel, setSelectedModel] = useState("");
  const [availableProviders, setAvailableProviders] = useState<AvailableProviders>();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const {
    sessions,
    createSession,
    deleteSession,
  } = useSessions();

  // Resolve selected model: user selection wins, then agent config default, then fallback
  const resolvedModel = useMemo(() => {
    if (models.length === 0) return selectedModel;

    // User-selected model takes priority
    if (selectedModel) return selectedModel;

    // Agent config default for active session (used as initial value)
    const activeSession = sessions.find(s => s.id === activeSessionId);
    if (activeSession?.agentConfigId) {
      const config = configs.find(c => c.id === activeSession.agentConfigId);
      if (config?.defaultModelId) return config.defaultModelId;
    }

    // Fallback: first available model
    const enabledSet = settings?.enabledModels?.length ? new Set(settings.enabledModels) : null;
    const firstAvailable = enabledSet
      ? models.find(m => enabledSet.has(m.id))
      : models[0];
    return firstAvailable?.id ?? defaultModel?.id ?? "";
  }, [activeSessionId, sessions, configs, models, settings, defaultModel, selectedModel]);

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

  // Select first session on load if available
  useEffect(() => {
    if (sessions.length > 0 && !activeSessionId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initializing activeSessionId from async-loaded sessions; cannot compute during render
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  const handleNewChat = useCallback(async (agentConfigId?: string) => {
    const newSession = await createSession(undefined, agentConfigId);
    if (newSession) {
      setActiveSessionId(newSession.id);
    }
  }, [createSession]);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      const success = await deleteSession(id);
      if (success && activeSessionId === id) {
        // Select another session or null
        const remaining = sessions.filter((s) => s.id !== id);
        setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
      }
    },
    [deleteSession, activeSessionId, sessions]
  );

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  const router = useRouter();
  const pathname = usePathname();

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+N (Mac) / Ctrl+N (Windows/Linux) → New chat
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        handleNewChat();
        if (pathname !== "/") {
          router.push("/");
        }
      }

      // Escape → Focus prompt input (only on chat page)
      if (e.key === "Escape" && pathname === "/") {
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
    activeSessionId,
    selectedModel: resolvedModel,
    availableProviders,
    settings,
    models,
    getModelConfig,
    sidebarCollapsed,
    setActiveSessionId,
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
              activeSessionId={activeSessionId}
              onSelectSession={handleSelectSession}
              onNewChat={handleNewChat}
              onDeleteSession={handleDeleteSession}
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
