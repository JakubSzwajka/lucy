"use client";

import { useMemo, useState, useEffect } from "react";
import {
  PromptInput,
  PromptInputProvider,
  PromptInputTextarea,
  PromptInputHeader,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSubmit,
  PromptInputButton,
  usePromptInputController,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import type { FileUIPart } from "ai";
import {
  ModelSelector as ModelSelectorRoot,
  ModelSelectorTrigger,
  ModelSelectorContent,
  ModelSelectorInput,
  ModelSelectorList,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorItem,
  ModelSelectorLogo,
  ModelSelectorName,
} from "@/components/ai-elements/model-selector";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { api } from "@/lib/client/api/client";
import { estimateConversationTokens, getContextUsage } from "@/lib/server/ai/tokens";
import { useMainContext } from "@/app/(main)/layout";
import type { ChatMessage, ModelConfig, AvailableProviders, McpServer, McpServerStatus } from "@/types";
import { ChevronDown, Lightbulb, Wrench, Server, Loader2, Paperclip, X } from "lucide-react";
import { compressImageDataUrl } from "@/lib/client/utils/image-compress";

interface RegisteredToolInfo {
  key: string;
  name: string;
  description: string;
  source: {
    type: "mcp" | "builtin" | "delegate";
    serverId?: string;
    serverName?: string;
    moduleId?: string;
    configId?: string;
    configName?: string;
  };
}

function getProviderFromModelId(modelId: string): string {
  const slashIndex = modelId.indexOf("/");
  return slashIndex > 0 ? modelId.substring(0, slashIndex) : "openrouter";
}

function formatProviderLabel(provider: string): string {
  const labels: Record<string, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google",
    meta: "Meta",
    mistral: "Mistral",
    deepseek: "DeepSeek",
    cohere: "Cohere",
    perplexity: "Perplexity",
    xai: "xAI",
  };
  return labels[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
}

interface ChatInputProps {
  onSend: (message: string, files?: FileUIPart[]) => void;
  onStop?: () => void;
  prefillText?: string;
  prefillNonce?: number;
  isLoading?: boolean;
  messages?: ChatMessage[];
  modelConfig?: ModelConfig;
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  availableProviders?: AvailableProviders;
  enabledModels?: string[];
  thinkingEnabled: boolean;
  onThinkingChange: (enabled: boolean) => void;
  supportsThinking: boolean;
  sessionId?: string | null;
  mcpServers?: McpServer[];
  enabledMcpServers?: McpServerStatus[];
  onMcpToggle?: (serverId: string, enabled: boolean) => void;
  isMcpLoading?: boolean;
}

function AttachmentPreview() {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) return null;

  return (
    <PromptInputHeader className="px-3 pt-3 pb-1">
      <div className="flex gap-2 flex-wrap">
        {attachments.files.map((file) => (
          <div key={file.id} className="relative group">
            {file.mediaType?.startsWith("image/") && file.url ? (
              <img
                src={file.url}
                alt={file.filename || "attachment"}
                className="h-16 w-16 object-cover rounded-md border border-border"
              />
            ) : (
              <div className="h-16 w-16 rounded-md border border-border flex items-center justify-center bg-muted text-xs text-muted-foreground">
                {file.filename?.split(".").pop() || "file"}
              </div>
            )}
            <button
              type="button"
              onClick={() => attachments.remove(file.id)}
              className="absolute -top-1.5 -right-1.5 bg-background border border-border rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
      </div>
    </PromptInputHeader>
  );
}

function AttachmentButton() {
  const attachments = usePromptInputAttachments();
  return (
    <PromptInputButton
      onClick={() => attachments.openFileDialog()}
      className="gap-1.5 text-muted-foreground hover:text-foreground"
    >
      <Paperclip className="size-3.5" />
    </PromptInputButton>
  );
}

function ChatInputInner({
  onSend,
  onStop,
  prefillText,
  prefillNonce,
  isLoading,
  messages = [],
  modelConfig,
  selectedModel,
  onModelChange,
  availableProviders,
  enabledModels,
  thinkingEnabled,
  onThinkingChange,
  supportsThinking,
  sessionId,
  mcpServers = [],
  enabledMcpServers = [],
  onMcpToggle,
  isMcpLoading,
}: ChatInputProps) {
  const { models, getModelConfig } = useMainContext();
  const { textInput } = usePromptInputController();
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [tools, setTools] = useState<RegisteredToolInfo[]>([]);
  const [isToolsLoading, setIsToolsLoading] = useState(true);

  useEffect(() => {
    if (prefillNonce !== undefined && prefillText !== undefined) {
      textInput.setInput(prefillText);
    }
  }, [prefillNonce, prefillText, textInput]);

  useEffect(() => {
    let cancelled = false;
    const url = sessionId ? `/api/tools?sessionId=${sessionId}` : "/api/tools";
    api.request<{ tools: RegisteredToolInfo[] }>(url)
      .then((data) => { if (!cancelled) { setTools(data.tools || []); setIsToolsLoading(false); } })
      .catch(() => { if (!cancelled) { setTools([]); setIsToolsLoading(false); } });
    return () => { cancelled = true; };
  }, [sessionId]);

  const enabledMcpIds = new Set(enabledMcpServers.map((s) => s.serverId));

  const getMcpStatusDot = (serverId: string) => {
    const status = enabledMcpServers.find((s) => s.serverId === serverId);
    if (!status) return null;
    if (status.connected) {
      return <span className="size-1.5 rounded-full bg-emerald-500" title={`Connected - ${status.tools.length} tools`} />;
    }
    if (status.error) {
      return <span className="size-1.5 rounded-full bg-red-500" title={status.error} />;
    }
    return <span className="size-1.5 rounded-full bg-yellow-500 animate-pulse" title="Connecting..." />;
  };

  const contextUsage = useMemo(() => {
    if (!modelConfig) return null;
    const tokens = estimateConversationTokens(messages);
    return getContextUsage(tokens, modelConfig.maxContextTokens);
  }, [messages, modelConfig]);

  const handleSubmit = async ({ text, files }: { text: string; files: FileUIPart[] }) => {
    const hasText = text.trim().length > 0;
    const hasFiles = files.length > 0;
    if (!hasText && !hasFiles) return;

    const compressedFiles = await Promise.all(
      files.map(async (f) => {
        if (f.mediaType?.startsWith("image/") && f.url) {
          const compressed = await compressImageDataUrl(f.url, f.mediaType);
          return { ...f, url: compressed };
        }
        return f;
      })
    );

    onSend(text.trim(), compressedFiles.length > 0 ? compressedFiles : undefined);
  };

  const isModelAvailable = (): boolean => {
    if (!availableProviders) return true;
    return availableProviders.openrouter;
  };

  const visibleModels = useMemo(
    () => models.filter((model) => !enabledModels || enabledModels.length === 0 || enabledModels.includes(model.id)),
    [enabledModels, models]
  );

  const modelsByProvider = useMemo(() => {
    const grouped: Record<string, ModelConfig[]> = {};
    for (const model of visibleModels) {
      const provider = getProviderFromModelId(model.id);
      if (!grouped[provider]) grouped[provider] = [];
      grouped[provider].push(model);
    }
    return grouped;
  }, [visibleModels]);

  const selectedModelConfig = getModelConfig(selectedModel);

  const handleModelSelect = (modelId: string) => {
    onModelChange(modelId);
    setModelSelectorOpen(false);
  };

  return (
    <div className="p-6 border-t border-border bg-background">
      <PromptInput
        onSubmit={handleSubmit}
        accept="image/*"
        multiple
        className="border border-border rounded-lg focus-within:border-muted-darker transition-all bg-background-secondary/20"
      >
        <AttachmentPreview />
        <PromptInputTextarea
          placeholder="Type a message or command..."
          disabled={isLoading}
          className="min-h-[40px] max-h-32 py-3 px-3 text-sm border-none bg-transparent focus:outline-none focus:ring-0 placeholder:text-muted-dark"
        />
        <PromptInputFooter className="px-2 pb-2">
          <PromptInputTools>
            <AttachmentButton />

            <ModelSelectorRoot open={modelSelectorOpen} onOpenChange={setModelSelectorOpen}>
              <ModelSelectorTrigger asChild>
                <PromptInputButton className="gap-1.5 text-muted-foreground hover:text-foreground">
                  {selectedModelConfig && (
                    <ModelSelectorLogo provider={getProviderFromModelId(selectedModelConfig.id)} />
                  )}
                  <span className="text-xs">{selectedModelConfig?.name ?? selectedModel}</span>
                  <ChevronDown className="size-3 opacity-50" />
                </PromptInputButton>
              </ModelSelectorTrigger>
              <ModelSelectorContent>
                <ModelSelectorInput placeholder="Search models..." />
                <ModelSelectorList>
                  <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                  {Object.entries(modelsByProvider)
                    .filter(([, models]) => models.length > 0)
                    .map(([provider, models]) => (
                      <ModelSelectorGroup key={provider} heading={formatProviderLabel(provider)}>
                        {models.map((model) => {
                          const available = isModelAvailable();
                          return (
                            <ModelSelectorItem
                              key={model.id}
                              value={model.id}
                              onSelect={() => handleModelSelect(model.id)}
                              disabled={!available}
                              className="flex items-center gap-2"
                            >
                              <ModelSelectorLogo provider={getProviderFromModelId(model.id)} />
                              <ModelSelectorName>
                                {model.name}
                                {!available && " (N/A)"}
                              </ModelSelectorName>
                            </ModelSelectorItem>
                          );
                        })}
                      </ModelSelectorGroup>
                    ))}
                </ModelSelectorList>
              </ModelSelectorContent>
            </ModelSelectorRoot>

            {supportsThinking && (
              <PromptInputButton
                onClick={() => onThinkingChange(!thinkingEnabled)}
                className={`gap-1.5 ${thinkingEnabled ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Lightbulb className={`size-3.5 ${thinkingEnabled ? "text-amber-500" : ""}`} />
                <span className="text-xs">Thinking</span>
                <span
                  className={`size-1.5 rounded-full transition-all ${
                    thinkingEnabled ? "bg-emerald-400" : "bg-muted-dark"
                  }`}
                />
              </PromptInputButton>
            )}

            <Popover open={toolsOpen} onOpenChange={setToolsOpen}>
              <PopoverTrigger asChild>
                <PromptInputButton className="gap-1.5 text-muted-foreground hover:text-foreground">
                  <Wrench className="size-3.5" />
                  <span className="text-xs">Tools</span>
                  {isToolsLoading ? (
                    <Loader2 className="size-3 animate-spin text-muted-dark" />
                  ) : (
                    <span className="text-xs text-muted-dark">({tools.length})</span>
                  )}
                  <ChevronDown className={`size-3 opacity-50 transition-transform ${toolsOpen ? "rotate-180" : ""}`} />
                </PromptInputButton>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-[300px] max-h-[320px] overflow-y-auto p-2">
                {tools.filter((t) => t.source.type === "builtin").length > 0 && (
                  <>
                    <div className="px-2 py-1.5 border-b border-border mb-1">
                      <span className="text-xs text-muted-dark uppercase tracking-wide">
                        Builtin ({tools.filter((t) => t.source.type === "builtin").length})
                      </span>
                    </div>
                    {tools.filter((t) => t.source.type === "builtin").map((tool) => (
                      <div key={tool.key} className="px-2 py-1.5 hover:bg-background-secondary rounded transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{tool.name}</span>
                          <span className="text-xs text-muted-darkest">({tool.source.moduleId})</span>
                        </div>
                        <div className="text-xs text-muted-dark line-clamp-1">{tool.description}</div>
                      </div>
                    ))}
                  </>
                )}
                {tools.filter((t) => t.source.type === "mcp").length > 0 && (
                  <>
                    <div className="px-2 py-1.5 border-b border-border mb-1 mt-1">
                      <span className="text-xs text-muted-dark uppercase tracking-wide">
                        MCP ({tools.filter((t) => t.source.type === "mcp").length})
                      </span>
                    </div>
                    {tools.filter((t) => t.source.type === "mcp").map((tool) => (
                      <div key={tool.key} className="px-2 py-1.5 hover:bg-background-secondary rounded transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{tool.name}</span>
                          <span className="text-xs text-muted-darkest">({tool.source.serverName || tool.source.serverId})</span>
                        </div>
                        <div className="text-xs text-muted-dark line-clamp-1">{tool.description}</div>
                      </div>
                    ))}
                  </>
                )}
                {tools.filter((t) => t.source.type === "delegate").length > 0 && (
                  <>
                    <div className="px-2 py-1.5 border-b border-border mb-1 mt-1">
                      <span className="text-xs text-muted-dark uppercase tracking-wide">
                        Delegate ({tools.filter((t) => t.source.type === "delegate").length})
                      </span>
                    </div>
                    {tools.filter((t) => t.source.type === "delegate").map((tool) => (
                      <div key={tool.key} className="px-2 py-1.5 hover:bg-background-secondary rounded transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{tool.name}</span>
                          <span className="text-xs text-muted-darkest">({tool.source.configName || tool.source.configId})</span>
                        </div>
                        <div className="text-xs text-muted-dark line-clamp-1">{tool.description}</div>
                      </div>
                    ))}
                  </>
                )}
                {tools.length === 0 && (
                  <div className="px-2 py-3 text-center text-xs text-muted-dark">
                    {isToolsLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="size-3 animate-spin" />
                        <span>Loading tools...</span>
                      </div>
                    ) : (
                      "No tools registered"
                    )}
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {(mcpServers.length > 0 || isMcpLoading) && onMcpToggle && (
              <Popover open={mcpOpen} onOpenChange={setMcpOpen}>
                <PopoverTrigger asChild>
                  <PromptInputButton
                    disabled={isMcpLoading}
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <Server className="size-3.5" />
                    <span className="text-xs">MCP</span>
                    {isMcpLoading ? (
                      <Loader2 className="size-3 animate-spin text-muted-dark" />
                    ) : enabledMcpServers.length > 0 ? (
                      <>
                        <span className="text-xs text-muted-dark">({enabledMcpServers.length})</span>
                        <span className="size-1.5 rounded-full bg-emerald-400" />
                      </>
                    ) : (
                      <span className="text-xs text-muted-dark">(0)</span>
                    )}
                    <ChevronDown className={`size-3 opacity-50 transition-transform ${mcpOpen ? "rotate-180" : ""}`} />
                  </PromptInputButton>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-[260px] p-2">
                  <div className="px-2 py-1.5 border-b border-border mb-1">
                    <span className="text-xs text-muted-dark uppercase tracking-wide">MCP Servers</span>
                  </div>
                  {mcpServers.map((server) => {
                    const isEnabled = enabledMcpIds.has(server.id);
                    const status = enabledMcpServers.find((s) => s.serverId === server.id);
                    const toolCount = status?.tools.length ?? 0;

                    return (
                      <button
                        key={server.id}
                        onClick={() => onMcpToggle(server.id, !isEnabled)}
                        disabled={isMcpLoading}
                        className="w-full text-left px-2 py-2 hover:bg-background-secondary rounded transition-colors flex items-center gap-2"
                      >
                        <div
                          className={`size-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                            isEnabled ? "bg-emerald-500 border-emerald-500" : "border-border hover:border-muted-dark"
                          }`}
                        >
                          {isEnabled && (
                            <svg className="size-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {isEnabled && getMcpStatusDot(server.id)}
                            <span className="text-xs font-medium truncate">{server.name}</span>
                          </div>
                        </div>
                        {isEnabled && status?.connected && (
                          <span className="text-xs text-muted-dark flex-shrink-0">{toolCount} tools</span>
                        )}
                      </button>
                    );
                  })}
                  {mcpServers.length === 0 && (
                    <div className="px-2 py-3 text-center text-xs text-muted-dark">No MCP servers configured</div>
                  )}
                </PopoverContent>
              </Popover>
            )}
          </PromptInputTools>
          <PromptInputSubmit
            disabled={isLoading && !onStop}
            onStop={onStop}
            className="btn-ship"
            status={isLoading ? "streaming" : undefined}
          >
            Ship
          </PromptInputSubmit>
        </PromptInputFooter>
      </PromptInput>

      <div className="mt-2 flex gap-4 justify-between">
        <div className="flex gap-4">
          <span className="label-sm text-muted-darkest">
            SHORTCUTS: ENTER TO SHIP • SHIFT+ENTER FOR NEW LINE • ESC TO FOCUS
          </span>
          <span className="label-sm text-muted-darkest">MODE: CHAT_v1.0</span>
        </div>
        {contextUsage && (
          <span
            className={`label-sm ${
              contextUsage.isOverLimit
                ? "text-red-500"
                : contextUsage.isNearLimit
                  ? "text-yellow-500"
                  : "text-muted-darkest"
            }`}
          >
            CTX: {contextUsage.formatted} ({contextUsage.percentage}%)
          </span>
        )}
      </div>
    </div>
  );
}

export function ChatInput(props: ChatInputProps) {
  return (
    <PromptInputProvider>
      <ChatInputInner {...props} />
    </PromptInputProvider>
  );
}
