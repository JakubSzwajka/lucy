import { useCallback, useEffect, useState } from "react";

import { getSessionItems, sendMessage } from "@/api/client";
import type { Item, MessageItem } from "@/api/types";
import { ChatInput } from "@/components/ChatInput";
import { MessageList } from "@/components/MessageList";

interface ChatPanelProps {
  sessionId: string;
  onMessageSent?: () => void;
}

export function ChatPanel({ sessionId, onMessageSent }: ChatPanelProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const res = await getSessionItems(sessionId);
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    }
  }, [sessionId]);

  useEffect(() => {
    setItems([]);
    setError(null);
    fetchItems();
  }, [fetchItems]);

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
      await sendMessage(sessionId, message);
      await fetchItems();
      onMessageSent?.();
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
      {error && (
        <div className="border-t border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <ChatInput onSend={handleSend} disabled={sending} />
    </div>
  );
}
