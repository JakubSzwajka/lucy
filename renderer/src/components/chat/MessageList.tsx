"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { MessageBubble } from "./MessageBubble";
import { AgentActivityContainer } from "./AgentActivity";
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

  // Check if currently streaming and last message is assistant with activities but no content
  const lastMessage = messages[messages.length - 1];
  const isStreamingActivities = isLoading &&
    lastMessage?.role === "assistant" &&
    (lastMessage.activities?.length ?? 0) > 0 &&
    !lastMessage.content;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <SessionDivider />

      {messages.map((message, index) => {
        const isLastMessage = index === messages.length - 1;
        const hasActivities = message.role === "assistant" && (message.activities?.length ?? 0) > 0;
        const showActivities = hasActivities && (message.content || isLastMessage);

        return (
          <div key={message.id} className="flex flex-col items-start">
            {/* Agent activities (reasoning, tool calls, etc.) above the message */}
            {showActivities && (
              <AgentActivityContainer
                activities={message.activities ?? []}
                isStreaming={isLastMessage && isLoading && !message.content}
              />
            )}

            {/* Only show message bubble if there's content, or if it's not streaming activities */}
            {(message.content || !isStreamingActivities || !isLastMessage) && (
              <MessageBubble
                role={message.role}
                content={message.content}
                model={message.role === "assistant" ? message.model : undefined}
                timestamp={message.createdAt ? new Date(message.createdAt) : undefined}
              />
            )}
          </div>
        );
      })}

      {/* Loading indicator when waiting for response (no message yet) */}
      {isLoading && (lastMessage?.role === "user" || messages.length === 0) && (
        <div className="flex flex-col items-start gap-1">
          <span className="label-dark mx-1">// LUCY.THINKING</span>
          <div className="bg-assistant-bubble border border-assistant-bubble-border rounded-lg px-4 py-3">
            <div className="flex space-x-2">
              <div className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:100ms]" />
              <div className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:200ms]" />
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
