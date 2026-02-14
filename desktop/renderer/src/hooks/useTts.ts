"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cleanTextForSpeech } from "@/lib/tts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const electron = typeof window !== "undefined" ? (window as any).electron : null;

export function useTts() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!electron) return;

    const offLoading = electron.on("tts:loading", (messageId: string) => {
      setLoadingId(messageId);
    });

    const offStarted = electron.on("tts:started", (messageId: string) => {
      setLoadingId(null);
      setSpeakingId(messageId);
    });

    const offFinished = electron.on("tts:finished", (_messageId: string) => {
      setLoadingId(null);
      setSpeakingId(null);
    });

    const offPlayAudio = electron.on("tts:play-audio", (messageId: string, base64Mp3: string) => {
      setLoadingId(null);
      setSpeakingId(messageId);

      // Clean up previous audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(`data:audio/mpeg;base64,${base64Mp3}`);
      audioRef.current = audio;
      audio.onended = () => {
        setSpeakingId(null);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setSpeakingId(null);
        audioRef.current = null;
      };
      audio.play().catch((err) => {
        console.error("[TTS] Audio play error:", err);
        setSpeakingId(null);
        audioRef.current = null;
      });
    });

    const offStopAudio = electron.on("tts:stop-audio", () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    });

    const offError = electron.on("tts:error", (_messageId: string, _errorMsg: string) => {
      setLoadingId(null);
      setSpeakingId(null);
    });

    return () => {
      offLoading();
      offStarted();
      offFinished();
      offPlayAudio();
      offStopAudio();
      offError();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const speak = useCallback((messageId: string, text: string) => {
    if (!electron) return;
    const cleaned = cleanTextForSpeech(text);
    if (!cleaned) return;
    electron.invoke("tts:speak", messageId, cleaned);
  }, []);

  const stop = useCallback(() => {
    if (!electron) return;
    electron.invoke("tts:stop");
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
