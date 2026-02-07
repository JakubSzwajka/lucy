'use client';

import { useState, useRef, useEffect } from 'react';
import {
  type UIMessage,
  isTextUIPart,
  isReasoningUIPart,
  isToolUIPart,
  getToolName,
} from 'ai';

export interface StreamEvent {
  id: string;
  timestamp: Date;
  type: 'text' | 'reasoning' | 'tool-call' | 'tool-result' | 'stream-start' | 'stream-end';
  summary: string;
  detail?: string;
}

function partToEvent(
  part: UIMessage['parts'][number],
  partKey: string,
): StreamEvent | null {
  if (isTextUIPart(part)) {
    return {
      id: partKey,
      timestamp: new Date(),
      type: 'text',
      summary: `Text (${part.text.length} chars)`,
      detail: part.text.length > 200 ? part.text.slice(0, 200) + '...' : part.text,
    };
  }

  if (isReasoningUIPart(part)) {
    return {
      id: partKey,
      timestamp: new Date(),
      type: 'reasoning',
      summary: 'Reasoning block',
      detail: part.text.length > 200 ? part.text.slice(0, 200) + '...' : part.text,
    };
  }

  if (isToolUIPart(part)) {
    const toolName = getToolName(part);

    if (part.state === 'output-available' || part.state === 'output-error') {
      return {
        id: partKey,
        timestamp: new Date(),
        type: 'tool-result',
        summary: `Tool result: ${toolName}`,
        detail: part.state === 'output-error'
          ? part.errorText
          : part.output
            ? JSON.stringify(part.output).slice(0, 200)
            : undefined,
      };
    }

    // "call" or any other in-progress state
    return {
      id: partKey,
      timestamp: new Date(),
      type: 'tool-call',
      summary: `Tool call: ${toolName}`,
      detail: part.input ? JSON.stringify(part.input).slice(0, 200) : undefined,
    };
  }

  return null;
}

export function useStreamEvents(rawMessages: UIMessage[], status: string) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const seenPartsRef = useRef<Set<string>>(new Set());
  const prevStatusRef = useRef<string>(status);

  useEffect(() => {
    // Detect stream start: status changed to streaming
    if (status === 'streaming' && prevStatusRef.current !== 'streaming') {
      const startEvent: StreamEvent = {
        id: `stream-start-${Date.now()}`,
        timestamp: new Date(),
        type: 'stream-start',
        summary: 'Stream started',
      };
      setEvents(prev => [...prev, startEvent]);
    }

    // Detect stream end
    if (prevStatusRef.current === 'streaming' && status !== 'streaming') {
      const endEvent: StreamEvent = {
        id: `stream-end-${Date.now()}`,
        timestamp: new Date(),
        type: 'stream-end',
        summary: 'Stream ended',
      };
      setEvents(prev => [...prev, endEvent]);
    }

    prevStatusRef.current = status;
  }, [status]);

  useEffect(() => {
    const newEvents: StreamEvent[] = [];

    for (const message of rawMessages) {
      if (message.role !== 'assistant') continue;

      const parts = message.parts || [];
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const partKey = `${message.id}-${i}-${part.type}`;

        if (seenPartsRef.current.has(partKey)) continue;
        seenPartsRef.current.add(partKey);

        const event = partToEvent(part, partKey);
        if (event) newEvents.push(event);
      }
    }

    if (newEvents.length > 0) {
      setEvents(prev => [...prev, ...newEvents]);
    }
  }, [rawMessages]);

  const clearEvents = () => {
    setEvents([]);
    seenPartsRef.current.clear();
  };

  return { events, clearEvents };
}
