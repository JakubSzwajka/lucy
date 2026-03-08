import { useCallback, useEffect, useState } from "react";

import { getHistory, getModels, sendMessage } from "@/api/client";
import type { Item, MessageItem, ModelDef } from "@/api/types";
import { ChatInput } from "@/components/ChatInput";
import { MessageList } from "@/components/MessageList";
import { ModelSelector } from "@/components/ModelSelector";
import { DEFAULT_MODEL_ID } from "@/models";

export function ChatPanel() {
  const [items, setItems] = useState<Item[]>([]);
  const [models, setModels] = useState<ModelDef[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState(
    () => localStorage.getItem("lucy-model-id") ?? DEFAULT_MODEL_ID,
  );
  const [thinkingEnabled, setThinkingEnabled] = useState(
    () => localStorage.getItem("lucy-thinking") !== "false",
  );

  function handleModelChange(modelId: string) {
    setSelectedModelId(modelId);
    localStorage.setItem("lucy-model-id", modelId);
  }

  function handleThinkingChange(enabled: boolean) {
    setThinkingEnabled(enabled);
    localStorage.setItem("lucy-thinking", String(enabled));
  }

  const selectedModel = models.find((m) => m.id === selectedModelId);
  const supportsReasoning = selectedModel?.supportsReasoning ?? false;

  const fetchItems = useCallback(async () => {
    try {
      const res = await getHistory();
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    getModels().then((res) => setModels(res.models)).catch(() => {});
  }, []);

  async function handleSend(message: string) {
    const optimisticItem: MessageItem = {
      id: crypto.randomUUID(),
      agentId: "",
      sequence: items.length,
      createdAt: new Date().toISOString(),
      type: "message",
      role: "user",
      content: message,
    };

    setItems((prev) => [...prev, optimisticItem]);
    setSending(true);
    setError(null);

    try {
      await sendMessage(message, {
        modelId: selectedModelId,
        thinkingEnabled: supportsReasoning && thinkingEnabled,
      });
      await fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setItems((prev) => prev.filter((i) => i.id !== optimisticItem.id));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <MessageList items={items} />
      <div className="border-t border-border px-4 py-2 flex items-center">
        <ModelSelector models={models} value={selectedModelId} onChange={handleModelChange} />
        <label className={`ml-3 flex items-center gap-1.5 text-sm select-none ${supportsReasoning ? "text-muted-foreground cursor-pointer" : "text-muted-foreground/40 cursor-not-allowed"}`}>
          <input
            type="checkbox"
            checked={supportsReasoning && thinkingEnabled}
            onChange={(e) => handleThinkingChange(e.target.checked)}
            disabled={!supportsReasoning}
            className="accent-primary"
          />
          Thinking
        </label>
      </div>
      {error && (
        <div className="border-t border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <ChatInput onSend={handleSend} disabled={sending} />
    </div>
  );
}
