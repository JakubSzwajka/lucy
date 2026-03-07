import { useRef, useState } from "react";

import { ChatPanel } from "@/components/ChatPanel";
import { Layout } from "@/components/Layout";
import { SessionList, type SessionListHandle } from "@/components/SessionList";

export function App() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const sessionListRef = useRef<SessionListHandle>(null);

  return (
    <Layout
      sidebar={
        <SessionList
          ref={sessionListRef}
          selectedId={selectedSessionId}
          onSelect={setSelectedSessionId}
          onSessionCreated={setSelectedSessionId}
        />
      }
    >
      {selectedSessionId ? (
        <ChatPanel
          key={selectedSessionId}
          sessionId={selectedSessionId}
          onMessageSent={() => sessionListRef.current?.refresh()}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          Select or create a session to start chatting
        </div>
      )}
    </Layout>
  );
}
