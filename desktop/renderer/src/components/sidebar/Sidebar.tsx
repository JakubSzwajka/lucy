"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SessionItem } from "./SessionItem";
import { AgentConfigPicker } from "@/components/agent-config-picker/AgentConfigPicker";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAgentConfigs } from "@/hooks/useAgentConfigs";
import type { Session } from "@/types";

interface NavItem {
  href: string;
  label: string;
  matchPrefix: string;
  icon: React.ReactNode;
  children?: NavItem[];
}

const COMMAND_CENTER_NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    matchPrefix: "/dashboard",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
    ),
  },
  {
    href: "/settings/team",
    label: "Team",
    matchPrefix: "/settings/team",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        <circle cx="12" cy="12" r="9" strokeWidth={1.5} strokeDasharray="2 3" />
      </svg>
    ),
  },
  {
    href: "/settings/models",
    label: "Agents",
    matchPrefix: "/settings/models",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    children: [
      {
        href: "/settings/models",
        label: "Models",
        matchPrefix: "/settings/models",
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        ),
      },
      {
        href: "/settings/prompts",
        label: "System Prompts",
        matchPrefix: "/settings/prompts",
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
      },
      {
        href: "/settings/agent-configs",
        label: "Agent Configs",
        matchPrefix: "/settings/agent-configs",
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
      },
    ],
  },
  {
    href: "/settings/mcp",
    label: "MCP Servers",
    matchPrefix: "/settings/mcp",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
      </svg>
    ),
  },
  {
    href: "/settings/memory",
    label: "Memory",
    matchPrefix: "/settings/memory",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
];

interface SidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: (agentConfigId?: string) => void;
  onDeleteSession: (id: string) => void;
  onPinSession: (id: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onPinSession,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { configs } = useAgentConfigs();
  const configNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of configs) map.set(c.id, c.name);
    return map;
  }, [configs]);
  const [showConfigPicker, setShowConfigPicker] = useState(false);
  const [agentsExpanded, setAgentsExpanded] = useState(true);
  const isOnSettings = pathname?.startsWith("/settings");
  const isOnDashboard = pathname?.startsWith("/dashboard");
  const isOnChat = !isOnSettings && !isOnDashboard;

  const handleSessionClick = (id: string) => {
    onSelectSession(id);
    if (!isOnChat) {
      router.push("/");
    }
  };

  const handleNewChatClick = () => {
    if (configs.length === 0) {
      // No configs yet — create session without config (first-time user)
      onNewChat();
      if (!isOnChat) router.push("/");
    } else if (configs.length === 1) {
      // Single config — auto-select it
      onNewChat(configs[0].id);
      if (!isOnChat) router.push("/");
    } else {
      // Multiple configs — show picker
      setShowConfigPicker(true);
    }
  };

  const handleConfigSelect = (configId: string) => {
    setShowConfigPicker(false);
    onNewChat(configId);
    if (!isOnChat) router.push("/");
  };

  return (
    <aside
      className={`pt-7 border-r border-border flex flex-col bg-background-tertiary transition-all duration-300 ease-in-out ${
        collapsed ? "w-16" : "w-80"
      }`}
    >
      {/* Small top spacing */}
      <div className="h-4 flex-shrink-0" />

      {/* Header */}
      <div className={`border-b border-border ${collapsed ? "px-3 pb-3" : "px-6 pb-6"}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <Image
                src="/logo.png"
                alt="Lucy"
                width={32}
                height={32}
                className="rounded-sm"
              />
            </Link>
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="p-1.5 rounded hover:bg-background transition-colors text-muted-dark hover:text-foreground"
                title="Expand sidebar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <Image
                src="/logo.png"
                alt="Lucy"
                width={32}
                height={32}
                className="rounded-sm flex-shrink-0"
              />
              <span className="label">lucy</span>
            </Link>
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="p-1.5 rounded hover:bg-background transition-colors text-muted-dark hover:text-foreground"
                title="Collapse sidebar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mode Toggle */}
      <div className={`border-b border-border ${collapsed ? "p-2" : "p-2 px-4"}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => router.push("/")}
              className={cn(
                "w-10 h-10 rounded flex items-center justify-center transition-colors",
                isOnChat
                  ? "bg-background-secondary text-foreground"
                  : "text-muted-dark hover:text-foreground hover:bg-background/50"
              )}
              title="Chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className={cn(
                "w-10 h-10 rounded flex items-center justify-center transition-colors",
                !isOnChat
                  ? "bg-background-secondary text-foreground"
                  : "text-muted-dark hover:text-foreground hover:bg-background/50"
              )}
              title="Command Center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex bg-background rounded-md p-0.5">
            <button
              onClick={() => router.push("/")}
              className={cn(
                "flex-1 px-2 py-1 text-[10px] mono uppercase tracking-wide rounded flex items-center justify-center gap-1.5 transition-colors",
                isOnChat
                  ? "bg-background-secondary text-foreground"
                  : "text-muted-dark hover:text-foreground"
              )}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Chat
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className={cn(
                "flex-1 px-2 py-1 text-[10px] mono uppercase tracking-wide rounded flex items-center justify-center gap-1.5 transition-colors",
                !isOnChat
                  ? "bg-background-secondary text-foreground"
                  : "text-muted-dark hover:text-foreground"
              )}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              Command
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      {isOnChat ? (
        <>
          {/* New Chat Button */}
          <div className={`border-b border-border ${collapsed ? "p-2 flex justify-center" : "p-4"}`}>
            <button
              onClick={handleNewChatClick}
              className={`btn-ship flex items-center justify-center ${
                collapsed ? "w-10 h-10 p-0" : "w-full gap-2"
              }`}
              title={collapsed ? "New Session" : undefined}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">New Session</span>
                  <kbd className="text-[10px] mono text-muted-dark bg-background/50 px-1.5 py-0.5 rounded border border-border">
                    {"⌘N"}
                  </kbd>
                </>
              )}
            </button>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {collapsed ? (
              <div className="flex flex-col items-center py-2 gap-1">
                {sessions.slice(0, 10).map((session) => (
                  <button
                    key={session.id}
                    onClick={() => handleSessionClick(session.id)}
                    className={`w-10 h-10 rounded flex items-center justify-center text-xs font-mono transition-colors ${
                      session.id === activeSessionId
                        ? "bg-background text-foreground"
                        : "hover:bg-background/50 text-muted-dark hover:text-foreground"
                    }`}
                    title={session.title || "Untitled Session"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </button>
                ))}
                {sessions.length > 10 && (
                  <span className="text-xs text-muted-darker">+{sessions.length - 10}</span>
                )}
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-4 text-center">
                <span className="label-dark">{"// NO_SESSIONS"}</span>
                <p className="text-sm text-muted-dark mt-2">Start a new conversation</p>
              </div>
            ) : (
              (() => {
                const pinned = sessions.filter((s) => s.isPinned);
                const unpinned = sessions.filter((s) => !s.isPinned);
                return (
                  <>
                    {pinned.length > 0 && (
                      <div>
                        <div className="px-4 pt-3 pb-1">
                          <span className="label text-muted-darker uppercase tracking-wider">Pinned</span>
                        </div>
                        {pinned.map((session) => (
                          <SessionItem
                            key={session.id}
                            session={session}
                            sessionNumber={sessions.length - sessions.indexOf(session)}
                            isActive={session.id === activeSessionId}
                            agentConfigName={session.agentConfigId ? configNameMap.get(session.agentConfigId) : undefined}
                            onSelect={() => handleSessionClick(session.id)}
                            onDelete={() => onDeleteSession(session.id)}
                            onPin={() => onPinSession(session.id)}
                          />
                        ))}
                      </div>
                    )}
                    {unpinned.length > 0 && (
                      <div>
                        {pinned.length > 0 && (
                          <div className="px-4 pt-3 pb-1">
                            <span className="label text-muted-darker uppercase tracking-wider">Recent</span>
                          </div>
                        )}
                        {unpinned.map((session) => (
                          <SessionItem
                            key={session.id}
                            session={session}
                            sessionNumber={sessions.length - sessions.indexOf(session)}
                            isActive={session.id === activeSessionId}
                            agentConfigName={session.agentConfigId ? configNameMap.get(session.agentConfigId) : undefined}
                            onSelect={() => handleSessionClick(session.id)}
                            onDelete={() => onDeleteSession(session.id)}
                            onPin={() => onPinSession(session.id)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                );
              })()
            )}
          </div>
        </>
      ) : (
        <>
          {/* Command Center Nav */}
          <div className="flex-1 overflow-y-auto">
            <nav className={collapsed ? "flex flex-col items-center py-2 gap-1" : "flex flex-col py-2"}>
              {COMMAND_CENTER_NAV.map((item) => {
                const hasChildren = item.children && item.children.length > 0;
                const childActive = hasChildren && item.children!.some(c => pathname?.startsWith(c.matchPrefix));
                const isExpanded = hasChildren && (agentsExpanded || childActive);

                if (collapsed) {
                  if (hasChildren) {
                    return item.children!.map((child) => {
                      const isActive = pathname?.startsWith(child.matchPrefix);
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            "w-10 h-10 rounded flex items-center justify-center transition-colors",
                            isActive
                              ? "bg-background text-foreground"
                              : "text-muted-dark hover:text-foreground hover:bg-background/50"
                          )}
                          title={child.label}
                        >
                          {child.icon}
                        </Link>
                      );
                    });
                  }
                  const isActive = pathname?.startsWith(item.matchPrefix);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "w-10 h-10 rounded flex items-center justify-center transition-colors",
                        isActive
                          ? "bg-background text-foreground"
                          : "text-muted-dark hover:text-foreground hover:bg-background/50"
                      )}
                      title={item.label}
                    >
                      {item.icon}
                    </Link>
                  );
                }

                if (hasChildren) {
                  return (
                    <div key={item.label}>
                      <button
                        onClick={() => setAgentsExpanded(!agentsExpanded)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors",
                          childActive
                            ? "text-foreground"
                            : "text-muted-dark hover:text-foreground hover:bg-background/50"
                        )}
                      >
                        {item.icon}
                        <span className="flex-1 text-left">{item.label}</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      {isExpanded && item.children!.map((child) => {
                        const isActive = pathname?.startsWith(child.matchPrefix);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "flex items-center gap-3 pl-8 pr-4 py-2 text-sm transition-colors",
                              isActive
                                ? "bg-background text-foreground"
                                : "text-muted-dark hover:text-foreground hover:bg-background/50"
                            )}
                          >
                            {child.icon}
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  );
                }

                const isActive = pathname?.startsWith(item.matchPrefix);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-background text-foreground"
                        : "text-muted-dark hover:text-foreground hover:bg-background/50"
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}

      {/* Footer - User Info */}
      {user && (
        <div className="border-t border-border p-3">
          {collapsed ? (
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-8 h-8 rounded-full bg-background-secondary flex items-center justify-center text-xs mono text-foreground"
                title={user.name || user.email}
              >
                {(user.name || user.email)[0].toUpperCase()}
              </div>
              <button
                onClick={logout}
                className="p-1.5 rounded hover:bg-background transition-colors text-muted-dark hover:text-foreground"
                title="Log out"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-background-secondary flex items-center justify-center text-xs mono text-foreground flex-shrink-0">
                {(user.name || user.email)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                {user.name && (
                  <div className="text-xs text-foreground truncate">{user.name}</div>
                )}
                <div className="text-[11px] text-muted-dark truncate">{user.email}</div>
              </div>
              <button
                onClick={logout}
                className="p-1.5 rounded hover:bg-background transition-colors text-muted-dark hover:text-foreground flex-shrink-0"
                title="Log out"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
      {showConfigPicker && (
        <AgentConfigPicker
          configs={configs}
          onSelect={handleConfigSelect}
          onClose={() => setShowConfigPicker(false)}
        />
      )}
    </aside>
  );
}
