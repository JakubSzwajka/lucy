"use client";

import { useState, useCallback, useEffect, useRef, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { AuthGuard } from "@/components/auth-guard";
import { api } from "@/lib/api/client";
import { useSessions } from "@/hooks/useSessions";
import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_MODEL, AVAILABLE_MODELS } from "@/lib/ai/models";
import type { AvailableProviders } from "@/types";

interface MainContextType {
  activeSessionId: string | null;
  selectedModel: string;
  availableProviders?: AvailableProviders;
  settings: ReturnType<typeof useSettings>["settings"];
  sidebarCollapsed: boolean;
  setActiveSessionId: (id: string | null) => void;
  setSelectedModel: (model: string) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  handleNewChat: () => Promise<void>;
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

  const [selectedModel, setSelectedModel] = useState(
    () => settings?.defaultModelId || DEFAULT_MODEL.id
  );
  const [availableProviders, setAvailableProviders] = useState<AvailableProviders>();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Track whether settings default model has been applied
  const appliedDefaultModelRef = useRef(false);

  // Apply default model from settings when settings load (only once)
  useEffect(() => {
    if (settings?.defaultModelId && !appliedDefaultModelRef.current) {
      appliedDefaultModelRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- applying default model from async-loaded settings
      setSelectedModel(settings.defaultModelId);
    }
  }, [settings?.defaultModelId]);

  const selectedModelRef = useRef(selectedModel);
  useEffect(() => {
    selectedModelRef.current = selectedModel;
  }, [selectedModel]);

  useEffect(() => {
    async function fetchProviders() {
      try {
        const providers = await api.request<AvailableProviders>("/api/providers");
        setAvailableProviders(providers);

        // If current selected model's provider is unavailable, select first available model
        const currentModel = AVAILABLE_MODELS.find(m => m.id === selectedModelRef.current);
        if (currentModel && !providers[currentModel.provider]) {
          const firstAvailable = AVAILABLE_MODELS.find(m => providers[m.provider]);
          if (firstAvailable) {
            setSelectedModel(firstAvailable.id);
          }
        }
      } catch (error) {
        console.error("[App] Failed to fetch available providers:", error);
      }
    }
    fetchProviders();
  }, []);

  const {
    sessions,
    createSession,
    deleteSession,
  } = useSessions();

  // Select first session on load if available
  useEffect(() => {
    if (sessions.length > 0 && !activeSessionId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initializing activeSessionId from async-loaded sessions; cannot compute during render
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
    selectedModel,
    availableProviders,
    settings,
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
