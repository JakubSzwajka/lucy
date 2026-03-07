"use client";

import React from "react";
import Image from "next/image";
import { useState, useCallback, useMemo, useEffect, useRef, createContext, useContext } from "react";
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
  getStatusBadge,
  type ToolPart,
} from "@/components/ai-elements/tool";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/client/utils";
import { formatMessageTimestamp, formatGapTimestamp } from "@/lib/client/utils/format-timestamp";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  CopyIcon,
  CheckIcon,
  Loader2Icon,
  PencilIcon,
  Volume2Icon,
  SquareIcon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react";
import { api } from "@/lib/client/api/client";
import { useTts } from "@/hooks/useTts";
import type { ChatMessage, ContentPart, ChildSessionSummary, SessionWithAgents, Item, MessageItem } from "@/types";

const TtsContext = createContext<{ speakingId: string | null; loadingId: string | null; toggle: (id: string, text: string) => void } | null>(null);

function ChildSessionCard({ childSession }: { childSession: ChildSessionSummary }) {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const toggle = useCallback(() => {
    if (!expanded && !loaded) {
      setLoading(true);
      api.request<SessionWithAgents>(`/api/sessions/${childSession.id}`)
        .then((data) => {
          const rootAgent = data.agents?.find((a) => a.id === data.rootAgentId) || data.agents?.[0];
          const items: Item[] = rootAgent?.items || [];
          const msgItems = items.filter((i): i is MessageItem => i.type === "message");
          setMessages(msgItems.map((m) => ({ role: m.role, content: m.content })));
          setLoaded(true);
        })
        .catch((err) => {
          console.error("[ChildSession] Failed to load:", err);
          setMessages([{ role: "system", content: "Failed to load sub-agent conversation." }]);
          setLoaded(true);
        })
        .finally(() => setLoading(false));
    }
    setExpanded((v) => !v);
  }, [expanded, loaded, childSession.id]);

  return (
    <div className="border border-border rounded-md overflow-hidden my-1">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/50 transition-colors"
      >
        <span className="text-muted-foreground">{expanded ? "\u25BC" : "\u25B6"}</span>
        <span className="label-dark">SUB-AGENT //</span>
        <span className="text-foreground font-medium truncate">{childSession.title}</span>
        <span className="ml-auto text-muted-dark">[{childSession.status}]</span>
      </button>
      {expanded && (
        <div className="border-t border-border px-3 py-2 bg-muted/20 space-y-2 max-h-80 overflow-y-auto">
          {loading && (
            <div className="text-xs text-muted-foreground">Loading...</div>
          )}
          {!loading && messages.map((msg, i) => (
            <div key={i} className="text-xs">
              <span className="label-dark uppercase">{msg.role}:</span>
              <div className="mt-0.5 text-foreground whitespace-pre-wrap">{msg.content}</div>
            </div>
          ))}
          {!loading && messages.length === 0 && loaded && (
            <div className="text-xs text-muted-foreground">No messages in sub-agent session.</div>
          )}
        </div>
      )}
    </div>
  );
}

interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  childSessions?: ChildSessionSummary[];
  hasMoreItems?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onRewind?: (messageId: string, newContent: string) => void;
}

function GapDivider({ date }: { date: Date }) {
  return (
    <div className="session-divider my-6">
      <span>{formatGapTimestamp(date)}</span>
    </div>
  );
}

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

function StreamingIndicator() {
  return (
    <div className="flex space-x-2 py-2">
      <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" />
      <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:100ms]" />
      <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:200ms]" />
    </div>
  );
}

function ToolCallGroup({ tools }: { tools: (ContentPart & { type: "tool_call" })[] }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);

  const allCompleted = tools.every((t) => t.status === "completed");
  const hasError = tools.some((t) => t.status === "failed");
  const runningCount = tools.filter((t) => t.status === "running" || t.status === "pending").length;

  const summary = hasError
    ? "Has errors"
    : allCompleted
      ? "All completed"
      : runningCount > 0
        ? `${runningCount} running`
        : "Pending";

  return (
    <div className="not-prose">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
      >
        <WrenchIcon className="size-4" />
        <span className="font-medium">{tools.length} tool calls</span>
        <Badge className="gap-1.5 rounded-full text-xs" variant="secondary">
          {hasError ? (
            <XCircleIcon className="size-4 text-red-600" />
          ) : allCompleted ? (
            <CheckCircleIcon className="size-4 text-green-600" />
          ) : (
            <ClockIcon className="size-4 animate-pulse" />
          )}
          {summary}
        </Badge>
        <ChevronDownIcon
          className={cn(
            "size-4 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>
      {expanded && (
        <div className="mt-1 ml-6 border-l border-border pl-3 space-y-0.5">
          {tools.map((tp) => {
            const state = mapToolStatus(tp.status);
            const isOpen = expandedToolId === tp.id;
            return (
              <div key={tp.id}>
                <button
                  onClick={() => setExpandedToolId(isOpen ? null : tp.id)}
                  className="flex items-center gap-2 text-muted-foreground text-xs py-0.5 transition-colors hover:text-foreground w-full"
                >
                  <span className="font-medium truncate">{tp.toolName}</span>
                  {getStatusBadge(state)}
                  <ChevronDownIcon
                    className={cn(
                      "size-3 ml-auto transition-transform",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>
                {isOpen && (
                  <div className="mt-1 mb-2 flex gap-2 text-sm [&>*]:flex-1 [&>*]:min-w-0">
                    {tp.args && Object.keys(tp.args).length > 0 && (
                      <ToolInput input={tp.args} />
                    )}
                    <ToolOutput
                      output={tp.result ? JSON.parse(tp.result) : undefined}
                      errorText={tp.error}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface MessageItemProps {
  message: ChatMessage;
  isStreaming?: boolean;
  childSessionsByCallId?: Map<string, ChildSessionSummary>;
  onRewind?: (messageId: string, newContent: string) => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1500);
  }, [text]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <button
      onClick={handleCopy}
      className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
      title={copied ? "Copied!" : "Copy message"}
    >
      {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
    </button>
  );
}

function MessageItem({ message, isStreaming, childSessionsByCallId, onRewind }: MessageItemProps) {
  const isUser = message.role === "user";
  const hasParts = message.parts && message.parts.length > 0;
  const hasContent = message.content && message.content.trim().length > 0;
  const tts = useContext(TtsContext);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const editRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.textContent = editContent;
      editRef.current.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(editRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [isEditing, editContent]);

  const formatTime = (date?: Date | string) => {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return formatMessageTimestamp(d);
  };

  const renderParts = (parts: ContentPart[]) => {
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < parts.length) {
      const part = parts[i];

      if (part.type === "reasoning") {
        elements.push(
          <Reasoning key={part.id} isStreaming={isStreaming} defaultOpen={false}>
            <ReasoningTrigger />
            <ReasoningContent>{part.content}</ReasoningContent>
          </Reasoning>
        );
        i++;
      } else if (part.type === "tool_call") {
        const toolGroup: ContentPart[] = [];
        const childSessionParts: ContentPart[] = [];
        while (i < parts.length && parts[i].type === "tool_call") {
          const tp = parts[i] as ContentPart & { type: "tool_call" };
          if (childSessionsByCallId?.get(tp.callId)) {
            childSessionParts.push(tp);
          } else {
            toolGroup.push(tp);
          }
          i++;
        }

        for (const csp of childSessionParts) {
          const cs = childSessionsByCallId?.get((csp as ContentPart & { type: "tool_call" }).callId);
          if (cs) elements.push(<ChildSessionCard key={csp.id} childSession={cs} />);
        }

        if (toolGroup.length === 1) {
          const tp = toolGroup[0] as ContentPart & { type: "tool_call" };
          const state = mapToolStatus(tp.status);
          elements.push(
            <Tool key={tp.id}>
              <ToolHeader type="dynamic-tool" toolName={tp.toolName} state={state} />
              <ToolContent>
                {tp.args && Object.keys(tp.args).length > 0 && (
                  <ToolInput input={tp.args} />
                )}
                <ToolOutput
                  output={tp.result ? JSON.parse(tp.result) : undefined}
                  errorText={tp.error}
                />
              </ToolContent>
            </Tool>
          );
        } else if (toolGroup.length > 1) {
          elements.push(
            <ToolCallGroup
              key={`tool-group-${toolGroup[0].id}`}
              tools={toolGroup as (ContentPart & { type: "tool_call" })[]}
            />
          );
        }
      } else if (part.type === "text") {
        elements.push(
          <MessageResponse key={part.id}>
            {part.text}
          </MessageResponse>
        );
        i++;
      } else {
        i++;
      }
    }

    return elements;
  };

  if (isUser) {
    const fileParts = message.parts?.filter((p) => p.type === "file") as (ContentPart & { type: "file" })[] | undefined;
    return (
      <Message from="user">
        <MessageContent>
          {isEditing ? (
            <div
              ref={editRef}
              contentEditable
              suppressContentEditableWarning
              className="outline-none whitespace-pre-wrap break-words min-h-[1.5em] text-foreground ring-1 ring-primary/50 rounded px-1 -mx-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const text = editRef.current?.textContent?.trim();
                  if (text && onRewind) {
                    onRewind(message.id, text);
                    setIsEditing(false);
                  }
                }
                if (e.key === "Escape") {
                  setIsEditing(false);
                }
              }}
            />
          ) : (
            <>
              {fileParts && fileParts.length > 0 && (
                <div className="flex gap-2 flex-wrap mb-2">
                  {fileParts.map((fp) => (
                    fp.mediaType?.startsWith("image/") ? (
                      <img
                        key={fp.id}
                        src={fp.url}
                        alt="attached image"
                        className="max-h-48 max-w-xs rounded-md border border-border object-contain"
                      />
                    ) : null
                  ))}
                </div>
              )}
              {hasContent && <MessageResponse>{message.content}</MessageResponse>}
            </>
          )}
        </MessageContent>
        <div className="label-sm mr-1 flex items-center gap-2">
          <span>SENT{message.createdAt && ` // ${formatTime(message.createdAt)}`}</span>
          <span className="flex items-center gap-1">
            {message.content && onRewind && (
              <button
                onClick={() => {
                  setEditContent(message.content || "");
                  setIsEditing(true);
                }}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                title="Edit message"
              >
                <PencilIcon className="size-3.5" />
              </button>
            )}
            {hasContent && <CopyButton text={message.content!} />}
          </span>
        </div>
      </Message>
    );
  }

  const getMessageText = (): string => {
    if (hasParts) {
      return message.parts!
        .filter((p) => p.type === "text")
        .map((p) => (p as ContentPart & { type: "text" }).text)
        .join("\n");
    }
    return message.content || "";
  };

  const isSpeaking = tts?.speakingId === message.id;
  const isLoading = tts?.loadingId === message.id;
  const messageText = getMessageText();

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
        <span>
          DELIVERED{message.createdAt && ` // ${formatTime(message.createdAt)}`}
          {message.model && <span className="text-muted-darker"> &bull; {message.model}</span>}
        </span>
        <span className="flex items-center gap-1">
          {messageText && <CopyButton text={messageText} />}
          {messageText && tts && (
            <button
              onClick={() => tts.toggle(message.id, messageText)}
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
              title={isLoading ? "Loading audio..." : isSpeaking ? "Stop speaking" : "Read aloud"}
            >
              {isLoading ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : isSpeaking ? (
                <SquareIcon className="size-3.5" />
              ) : (
                <Volume2Icon className="size-3.5" />
              )}
            </button>
          )}
        </span>
      </div>
    </Message>
  );
}

const ONE_HOUR_MS = 60 * 60 * 1000;

export function MessageList({ messages, isLoading, childSessions, hasMoreItems, isLoadingMore, onLoadMore, onRewind }: MessageListProps) {
  const tts = useTts();

  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const childSessionsByCallId = useMemo(() => {
    const map = new Map<string, ChildSessionSummary>();
    if (childSessions) {
      for (const cs of childSessions) {
        if (cs.sourceCallId) map.set(cs.sourceCallId, cs);
      }
    }
    return map;
  }, [childSessions]);
  if (messages.length === 0) {
    return (
      <ConversationEmptyState>
        <Image src="/logo.png" alt="Lucy" width={80} height={80} className="mb-4" />
        <span className="label block mb-2">{"// INIT.SEQUENCE"}</span>
        <h2 className="text-xl font-medium mb-2 tracking-tight text-foreground">Welcome to Lucy</h2>
        <p className="text-sm text-muted-foreground">Start a conversation by typing a message below.</p>
      </ConversationEmptyState>
    );
  }

  const lastMessage = messages[messages.length - 1];

  return (
    <TtsContext.Provider value={tts}>
    <Conversation>
      <ConversationContent className="p-6 gap-6">
        {hasMoreItems && (
          <div className="flex justify-center py-2">
            <button
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {isLoadingMore ? <Loader2Icon className="size-3 animate-spin" /> : null}
              {isLoadingMore ? "Loading..." : "Load older messages"}
            </button>
          </div>
        )}
        {messages.map((message, index) => {
          const isLastMessage = index === messages.length - 1;
          const isAssistantStreaming = isLastMessage && isLoading && message.role === "assistant";

          let gapDivider: React.ReactNode = null;
          if (message.createdAt) {
            const prevMessage = index > 0 ? messages[index - 1] : null;
            const prevTime = prevMessage?.createdAt
              ? (typeof prevMessage.createdAt === "string" ? new Date(prevMessage.createdAt) : prevMessage.createdAt).getTime()
              : null;
            const currTime = (typeof message.createdAt === "string" ? new Date(message.createdAt) : message.createdAt).getTime();
            if (prevTime && currTime - prevTime > ONE_HOUR_MS) {
              gapDivider = <GapDivider key={`gap-${message.id}`} date={typeof message.createdAt === "string" ? new Date(message.createdAt) : message.createdAt} />;
            }
          }

          return (
            <React.Fragment key={message.id}>
              {gapDivider}
              <MessageItem message={message} isStreaming={isAssistantStreaming} childSessionsByCallId={childSessionsByCallId} onRewind={onRewind} />
            </React.Fragment>
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
    </TtsContext.Provider>
  );
}
