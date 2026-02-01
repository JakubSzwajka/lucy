"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { MessageBubble } from "./MessageBubble";
import type { ChatMessage } from "@/types";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
}

function SessionDivider() {
  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="session-divider my-6">
      <span>Session Started: {today}</span>
    </div>
  );
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted">
        <div className="text-center">
          <Image
            src="/logo.png"
            alt="Lucy"
            width={80}
            height={80}
            className="mx-auto mb-4"
          />
          <span className="label block mb-2">// INIT.SEQUENCE</span>
          <h2 className="text-xl font-medium mb-2 tracking-tight">Welcome to Lucy</h2>
          <p className="text-sm text-muted-dark">Start a conversation by typing a message below.</p>
        </div>
      </div>
    );
  }

  const lastMessage = messages[messages.length - 1];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <SessionDivider />

      {messages.map((message, index) => {
        const isLastMessage = index === messages.length - 1;
        const isAssistantStreaming = isLastMessage && isLoading && message.role === "assistant";

        return (
          <MessageBubble
            key={message.id}
            role={message.role}
            content={message.content}
            model={message.role === "assistant" ? message.model : undefined}
            timestamp={message.createdAt ? new Date(message.createdAt) : undefined}
            parts={message.role === "assistant" ? message.parts : undefined}
            activities={message.role === "assistant" ? message.activities : undefined}
            isStreaming={isAssistantStreaming}
          />
        );
      })}

      {/* Loading indicator when waiting for response (no assistant message yet) */}
      {isLoading && (lastMessage?.role === "user" || messages.length === 0) && (
        <MessageBubble
          role="assistant"
          content=""
          isStreaming={true}
        />
      )}

      <div ref={bottomRef} />
    </div>
  );
}
