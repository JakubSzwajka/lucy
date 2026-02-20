"use client";

import { useState, useCallback, useRef } from "react";
import { cleanTextForSpeech } from "@/lib/tts";

export function useTts() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    setSpeakingId(null);
    setLoadingId(null);
  }, []);

  const speak = useCallback((messageId: string, text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const cleaned = cleanTextForSpeech(text);
    if (!cleaned) return;

    // Stop any current speech
    window.speechSynthesis.cancel();

    setLoadingId(messageId);

    const utterance = new SpeechSynthesisUtterance(cleaned);
    utteranceRef.current = utterance;

    utterance.onstart = () => {
      setLoadingId(null);
      setSpeakingId(messageId);
    };

    utterance.onend = () => {
      setSpeakingId(null);
      utteranceRef.current = null;
    };

    utterance.onerror = () => {
      setLoadingId(null);
      setSpeakingId(null);
      utteranceRef.current = null;
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  const toggle = useCallback(
    (messageId: string, text: string) => {
      if (speakingId === messageId || loadingId === messageId) {
        stop();
      } else {
        speak(messageId, text);
      }
    },
    [speakingId, loadingId, speak, stop]
  );

  return { speakingId, loadingId, toggle };
}
