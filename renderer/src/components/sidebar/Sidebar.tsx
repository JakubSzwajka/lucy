"use client";

import { SessionItem } from "./SessionItem";
import type { Session } from "@/types";

interface SidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onOpenSettings,
}: SidebarProps) {
  return (
    <aside className="w-80 border-r border-border flex flex-col bg-background-tertiary">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <h1 className="label mb-1">Architecture // Sessions</h1>
        <div className="text-sm font-medium">LUCY AI</div>
      </div>

      {/* New Chat Button */}
      <div className="p-4 border-b border-border">
        <button
          onClick={onNewChat}
          className="w-full btn-ship flex items-center justify-center gap-2"
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Session
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="p-4 text-center">
            <span className="label-dark">// NO_SESSIONS</span>
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
      <div className="p-4 border-t border-border">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs text-muted-dark hover:text-foreground transition-colors"
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
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Settings
        </button>
        <span className="label-sm text-muted-darker block text-center mt-2">
          POWERED BY AI // 2026
        </span>
      </div>
    </aside>
  );
}
