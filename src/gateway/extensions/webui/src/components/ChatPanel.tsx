import { useEffect, useState } from "react";

import { ChatInput } from "@/components/ChatInput";
import { MessageList } from "@/components/MessageList";
import { SessionBar } from "@/components/SessionBar";
import { useAgentStream } from "@/hooks/useAgentStream";

export function ChatPanel() {
  const [showActivity, setShowActivity] = useState(true);
  const { items, streaming, error, send, fetchItems } = useAgentStream(showActivity);

  // Load history on mount and when showActivity changes
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <SessionBar showActivity={showActivity} onShowActivityChange={setShowActivity} />
      <MessageList items={items} />
      {error && (
        <div className="border-t border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <ChatInput onSend={send} disabled={streaming} />
    </div>
  );
}
