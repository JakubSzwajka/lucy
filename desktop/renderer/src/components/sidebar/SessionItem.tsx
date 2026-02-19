"use client";

import { cn } from "@/lib/utils";
import type { Session } from "@/types";

interface SessionItemProps {
  session: Session;
  sessionNumber: number;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onPin?: () => void;
}

function formatLogNumber(num: number): string {
  return String(num).padStart(3, "0");
}

function formatTime(date: Date): string {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } else if (diffDays === 1) {
    return "YESTERDAY";
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }).toUpperCase();
  }
}

export function SessionItem({
  session,
  sessionNumber,
  isActive,
  onSelect,
  onDelete,
  onPin,
}: SessionItemProps) {
  return (
    <div
      className={cn(
        "group px-4 py-2.5 border-b border-border cursor-pointer transition-colors",
        isActive
          ? "bg-background-secondary/50"
          : "hover:bg-background-secondary/30"
      )}
      onClick={onSelect}
    >
      <div className="flex justify-between items-start mb-1">
        <span className="label text-muted">{"// "}SESSION.{formatLogNumber(sessionNumber)}</span>
        <div className="flex items-center gap-1.5">
          {session.isPinned && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3 text-foreground"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M16 12V4H17V2H7V4H8V12L6 14V16H11.2V22H12.8V16H18V14L16 12Z" />
            </svg>
          )}
          <span className="label-sm text-muted-dark">
            {formatTime(new Date(session.updatedAt))}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium truncate flex-1 pr-2 flex items-center gap-1.5">
          {session.agentConfigId && (
            <span className="w-2 h-2 rounded-full bg-foreground/40 flex-shrink-0" />
          )}
          {session.title}
        </div>
        {onPin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPin();
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-border rounded transition-opacity text-muted-dark hover:text-foreground"
            aria-label={session.isPinned ? "Unpin session" : "Pin session"}
            title={session.isPinned ? "Unpin session" : "Pin session"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              fill={session.isPinned ? "currentColor" : "none"}
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 4h3v2h-3V4zm-9 0h3v2H6V4zm3 2v10l-3 3h12l-3-3V6H9z"
              />
            </svg>
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-border rounded transition-opacity text-muted-dark hover:text-foreground"
          aria-label="Delete session"
          title="Delete session"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      {session.status === "archived" && (
        <span className="text-xs text-muted-dark mt-1 inline-block">
          [ARCHIVED]
        </span>
      )}
    </div>
  );
}
