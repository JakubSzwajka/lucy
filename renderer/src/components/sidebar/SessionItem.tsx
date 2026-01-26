"use client";

import { cn } from "@/lib/utils";
import type { Session } from "@/types";

interface SessionItemProps {
  session: Session;
  index: number;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function formatLogNumber(index: number): string {
  return String(index + 1).padStart(3, "0");
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
  index,
  isActive,
  onSelect,
  onDelete,
}: SessionItemProps) {
  return (
    <div
      className={cn(
        "group p-4 border-b border-border cursor-pointer transition-colors",
        isActive
          ? "bg-background-secondary/50"
          : "hover:bg-background-secondary/30"
      )}
      onClick={onSelect}
    >
      <div className="flex justify-between items-start mb-1">
        <span className="label text-muted">// SESSION.{formatLogNumber(index)}</span>
        <span className="label-sm text-muted-dark">
          {formatTime(new Date(session.updatedAt))}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium truncate flex-1 pr-2">
          {session.title}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-border rounded transition-opacity text-muted-dark hover:text-foreground"
          aria-label="Delete session"
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
