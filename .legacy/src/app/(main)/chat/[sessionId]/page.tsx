"use client";

import { useParams } from "next/navigation";
import { ChatContainer } from "@/components/chat";
import { useMainContext } from "../../layout";

export default function SessionChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const {
    selectedModel,
    setSelectedModel,
    availableProviders,
    settings,
  } = useMainContext();

  return (
    <ChatContainer
      sessionId={sessionId}
      selectedModel={selectedModel}
      onModelChange={setSelectedModel}
      availableProviders={availableProviders}
      enabledModels={settings?.enabledModels}
    />
  );
}
