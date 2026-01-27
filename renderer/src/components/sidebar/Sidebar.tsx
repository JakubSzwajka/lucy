"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SessionItem } from "./SessionItem";
import type { Session } from "@/types";

interface SidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const isOnSettings = pathname?.startsWith("/settings");

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
          // Collapsed header - logo centered with toggle below
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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 5l7 7-7 7M5 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}
          </div>
        ) : (
          // Expanded header - logo left, toggle right
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                  />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* New Chat Button */}
      <div className={`border-b border-border ${collapsed ? "p-2 flex justify-center" : "p-4"}`}>
        <button
          onClick={onNewChat}
          className={`btn-ship flex items-center justify-center ${
            collapsed ? "w-10 h-10 p-0" : "w-full gap-2"
          }`}
          title={collapsed ? "New Session" : undefined}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          {!collapsed && "New Session"}
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {collapsed ? (
          // Collapsed view - show session indicators
          <div className="flex flex-col items-center py-2 gap-1">
            {sessions.slice(0, 10).map((session) => (
              <button
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`w-10 h-10 rounded flex items-center justify-center text-xs font-mono transition-colors ${
                  session.id === activeSessionId
                    ? "bg-background text-foreground"
                    : "hover:bg-background/50 text-muted-dark hover:text-foreground"
                }`}
                title={session.title || "Untitled Session"}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
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
          sessions.map((session, index) => (
            <SessionItem
              key={session.id}
              session={session}
              sessionNumber={sessions.length - index}
              isActive={session.id === activeSessionId}
              onSelect={() => onSelectSession(session.id)}
              onDelete={() => onDeleteSession(session.id)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className={`border-t border-border ${collapsed ? "p-2 flex justify-center" : "p-4"}`}>
        <Link
          href="/settings"
          className={`flex items-center justify-center py-2 text-xs transition-colors rounded ${
            collapsed ? "w-10 h-10 hover:bg-background" : "w-full gap-2"
          } ${
            isOnSettings
              ? "text-foreground"
              : "text-muted-dark hover:text-foreground"
          }`}
          title={collapsed ? "Settings" : undefined}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          {!collapsed && "Settings"}
        </Link>
        {!collapsed && (
          <span className="label-sm text-muted-darker block text-center mt-2">
            POWERED BY AI // 2026
          </span>
        )}
      </div>
    </aside>
  );
}
