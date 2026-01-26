"use client";

import { ConversationItem } from "./ConversationItem";
import type { Conversation } from "@/types";

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
}

export function Sidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
}: SidebarProps) {
  return (
    <aside className="w-80 border-r border-border flex flex-col bg-background-tertiary">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <h1 className="label mb-1">Architecture // Threads</h1>
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
          New Thread
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center">
            <span className="label-dark">// NO_THREADS</span>
            <p className="text-sm text-muted-dark mt-2">Start a new conversation</p>
          </div>
        ) : (
          conversations.map((conversation, index) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              index={index}
              isActive={conversation.id === activeConversationId}
              onSelect={() => onSelectConversation(conversation.id)}
              onDelete={() => onDeleteConversation(conversation.id)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <span className="label-sm text-muted-darker block text-center">
          POWERED BY AI // 2026
        </span>
      </div>
    </aside>
  );
}
