"use client";

import Image from "next/image";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
  type ToolPart,
} from "@/components/ai-elements/tool";
import { QuickActions } from "./QuickActions";
import type { ChatMessage, ContentPart } from "@/types";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  onQuickAction?: (content: string) => void;
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
function mapToolStatus(status: string): ToolPart["state"] {
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
    <div className="flex space-x-2 py-2">
      <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" />
      <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:100ms]" />
      <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:200ms]" />
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
              <ReasoningTrigger />
              <ReasoningContent>{part.content}</ReasoningContent>
            </Reasoning>
          );
        case "tool_call": {
          const state = mapToolStatus(part.status);
          return (
            <Tool key={part.id}>
              <ToolHeader
                type="dynamic-tool"
                toolName={part.toolName}
                state={state}
              />
              <ToolContent>
                {part.args && Object.keys(part.args).length > 0 && (
                  <ToolInput input={part.args} />
                )}
                <ToolOutput
                  output={part.result ? JSON.parse(part.result) : undefined}
                  errorText={part.error}
                />
              </ToolContent>
            </Tool>
          );
        }
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
        <MessageContent>
          {hasContent && <MessageResponse>{message.content}</MessageResponse>}
        </MessageContent>
        <div className="label-sm mr-1">
          SENT{message.createdAt && ` // ${formatTime(message.createdAt)}`}
        </div>
      </Message>
    );
  }

  // Assistant message
  return (
    <Message from="assistant">
      <MessageContent>
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
      <div className="label-sm ml-1 flex items-center gap-2">
        DELIVERED{message.createdAt && ` // ${formatTime(message.createdAt)}`}
        {message.model && <span className="text-muted-darker">• {message.model}</span>}
      </div>
    </Message>
  );
}

export function MessageList({ messages, isLoading, onQuickAction }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <ConversationEmptyState>
        <Image
          src="/logo.png"
          alt="Lucy"
          width={80}
          height={80}
          className="mb-4"
        />
        <span className="label block mb-2">{"// INIT.SEQUENCE"}</span>
        <h2 className="text-xl font-medium mb-2 tracking-tight text-foreground">
          Welcome to Lucy
        </h2>
        <p className="text-sm text-muted-foreground">
          Start a conversation by typing a message below.
        </p>
        {onQuickAction && <QuickActions onSelect={onQuickAction} />}
      </ConversationEmptyState>
    );
  }

  const lastMessage = messages[messages.length - 1];

  return (
    <Conversation>
      <ConversationContent className="p-6 gap-6">
        <SessionDivider />

        {messages.map((message, index) => {
          const isLastMessage = index === messages.length - 1;
          const isAssistantStreaming =
            isLastMessage && isLoading && message.role === "assistant";

          return (
            <MessageItem
              key={message.id}
              message={message}
              isStreaming={isAssistantStreaming}
            />
          );
        })}

        {isLoading && (lastMessage?.role === "user" || messages.length === 0) && (
          <Message from="assistant">
            <MessageContent>
              <StreamingIndicator />
            </MessageContent>
          </Message>
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
