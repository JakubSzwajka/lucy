"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageToolbar,
} from "@/components/ai-elements/message";
import { Reasoning } from "@/components/ai-elements/reasoning";
import { Tool, type ToolState } from "@/components/ai-elements/tool";
import type { ChatMessage, ContentPart } from "@/types";

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

// Map our ContentPart status to AI Elements ToolState
function mapToolStatus(status: string): ToolState {
  switch (status) {
    case "pending":
      return "input-streaming";
    case "pending_approval":
      return "approval-requested";
    case "running":
      return "input-available";
    case "completed":
      return "output-available";
    case "failed":
      return "output-error";
    default:
      return "input-streaming";
  }
}

// Streaming indicator
function StreamingIndicator() {
  return (
    <div className="flex space-x-2">
      <div className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" />
      <div className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:100ms]" />
      <div className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce [animation-delay:200ms]" />
    </div>
  );
}

interface MessageItemProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

function MessageItem({ message, isStreaming }: MessageItemProps) {
  const isUser = message.role === "user";
  const hasParts = message.parts && message.parts.length > 0;
  const hasContent = message.content && message.content.trim().length > 0;

  const formatTime = (date?: Date | string) => {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  // Render parts in order (text, reasoning, tool calls)
  const renderParts = (parts: ContentPart[]) => {
    return parts.map((part) => {
      switch (part.type) {
        case "reasoning":
          return (
            <Reasoning
              key={part.id}
              isStreaming={isStreaming}
              defaultOpen={isStreaming}
            >
              {part.content}
            </Reasoning>
          );
        case "tool_call":
          return (
            <Tool
              key={part.id}
              name={part.toolName}
              state={mapToolStatus(part.status)}
              input={part.args}
              output={part.result}
              errorText={part.error}
            />
          );
        case "text":
          return (
            <MessageResponse key={part.id}>
              {part.text}
            </MessageResponse>
          );
        default:
          return null;
      }
    });
  };

  if (isUser) {
    return (
      <Message from="user">
        <MessageContent className="bg-user-bubble border-user-bubble-border">
          {hasContent && <MessageResponse>{message.content}</MessageResponse>}
        </MessageContent>
        <MessageToolbar>
          SENT{message.createdAt && ` // ${formatTime(message.createdAt)}`}
        </MessageToolbar>
      </Message>
    );
  }

  // Assistant message
  return (
    <Message from="assistant">
      <MessageContent className="bg-assistant-bubble border-assistant-bubble-border">
        {hasParts ? (
          <div className="space-y-3">
            {renderParts(message.parts!)}
          </div>
        ) : hasContent ? (
          <MessageResponse>{message.content}</MessageResponse>
        ) : isStreaming ? (
          <StreamingIndicator />
        ) : null}
      </MessageContent>
      <MessageToolbar>
        DELIVERED{message.createdAt && ` // ${formatTime(message.createdAt)}`}
        {message.model && <span className="text-muted-darker">• {message.model}</span>}
      </MessageToolbar>
    </Message>
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
          <MessageItem
            key={message.id}
            message={message}
            isStreaming={isAssistantStreaming}
          />
        );
      })}

      {/* Loading indicator when waiting for response (no assistant message yet) */}
      {isLoading && (lastMessage?.role === "user" || messages.length === 0) && (
        <Message from="assistant">
          <MessageContent className="bg-assistant-bubble border-assistant-bubble-border">
            <StreamingIndicator />
          </MessageContent>
        </Message>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
