import { useCallback, useEffect, useState } from "react";

import { getHistory, sendMessage } from "@/api/client";
import type { Item, MessageItem } from "@/api/types";
import { ChatInput } from "@/components/ChatInput";
import { MessageList } from "@/components/MessageList";
import { SessionBar } from "@/components/SessionBar";

export function ChatPanel() {
  const [items, setItems] = useState<Item[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showActivity, setShowActivity] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      const res = await getHistory(!showActivity);
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    }
  }, [showActivity]);

  useEffect(() => {
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
      await sendMessage(message);
      await fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setItems((prev) => prev.filter((i) => i.id !== optimisticItem.id));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <SessionBar showActivity={showActivity} onShowActivityChange={setShowActivity} />
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
