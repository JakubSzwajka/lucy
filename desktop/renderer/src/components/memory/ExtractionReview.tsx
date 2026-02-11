"use client";

import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

interface ExtractedMemory {
  type: string;
  content: string;
  confidenceScore: number;
  confidenceLevel: string;
  evidence: string;
  tags: string[];
  existingMemoryId?: string;
  suggestedConnections?: Array<{ existingMemoryId: string; relationshipType: string }>;
}

interface ExtractedQuestion {
  content: string;
  context: string;
  curiosityType: string;
  curiosityScore: number;
  timing: string;
  sourceMemoryIndices: number[];
}

interface ExtractionResult {
  memories: ExtractedMemory[];
  questions: ExtractedQuestion[];
  metadata: {
    sessionId: string;
    messagesAnalyzed: number;
    modelUsed: string;
    durationMs: number;
  };
}

interface ExtractionReviewProps {
  sessionId: string;
  onClose: () => void;
  onComplete?: (result: { memoriesSaved: number; questionsGenerated: number }) => void;
}

export function ExtractionReview({ sessionId, onClose, onComplete }: ExtractionReviewProps) {
  const [phase, setPhase] = useState<"idle" | "extracting" | "reviewing" | "saving" | "done">("idle");
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMemories, setSelectedMemories] = useState<Set<number>>(new Set());
  const [selectedQuestions, setSelectedQuestions] = useState<Set<number>>(new Set());
  const [editedMemories, setEditedMemories] = useState<Map<number, Partial<ExtractedMemory>>>(new Map());

  const extractMutation = useMutation({
    mutationFn: () => api.extractMemories(sessionId),
    onMutate: () => {
      setPhase("extracting");
      setError(null);
    },
    onSuccess: (data) => {
      setResult(data);
      setSelectedMemories(new Set(data.memories.map((_, i) => i)));
      setSelectedQuestions(new Set(data.questions.map((_, i) => i)));
      setPhase("reviewing");
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Extraction failed");
      setPhase("idle");
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => {
      if (!result) throw new Error("No result");
      const approvedMemories = result.memories.map((m, i) => ({
        ...m,
        approved: selectedMemories.has(i),
        edited: editedMemories.get(i),
      }));
      const approvedQuestions = result.questions.map((q, i) => ({
        ...q,
        approved: selectedQuestions.has(i),
      }));
      return api.confirmExtraction({
        sessionId: result.metadata.sessionId,
        approvedMemories,
        approvedQuestions,
      });
    },
    onMutate: () => setPhase("saving"),
    onSuccess: (confirmResult) => {
      setPhase("done");
      onComplete?.({
        memoriesSaved: confirmResult.memoriesSaved,
        questionsGenerated: confirmResult.questionsGenerated,
      });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Save failed");
      setPhase("reviewing");
    },
  });

  const handleExtract = useCallback(() => {
    extractMutation.mutate();
  }, [extractMutation]);

  const handleConfirm = useCallback(() => {
    if (!result) return;
    confirmMutation.mutate();
  }, [result, confirmMutation]);

  const toggleMemory = (idx: number) => {
    setSelectedMemories((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleQuestion = (idx: number) => {
    setSelectedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const updateMemoryContent = (idx: number, content: string) => {
    setEditedMemories((prev) => {
      const next = new Map(prev);
      next.set(idx, { ...next.get(idx), content });
      return next;
    });
  };

  const confidenceBadgeColor = (level: string) => {
    switch (level) {
      case "explicit": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "implied": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "inferred": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "speculative": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold">Memory Extraction</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {phase === "idle" && (
            <div className="text-center py-8">
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                Analyze this conversation to extract memories and questions.
              </p>
              <button
                onClick={handleExtract}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Start Extraction
              </button>
            </div>
          )}

          {phase === "extracting" && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-zinc-600 dark:text-zinc-400">Analyzing conversation...</p>
            </div>
          )}

          {phase === "reviewing" && result && (
            <div className="space-y-6">
              {/* Metadata */}
              <div className="text-sm text-zinc-500">
                {result.metadata.messagesAnalyzed} messages analyzed in {(result.metadata.durationMs / 1000).toFixed(1)}s
                using {result.metadata.modelUsed}
              </div>

              {/* Memories */}
              {result.memories.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3">
                    Extracted Memories ({selectedMemories.size}/{result.memories.length})
                  </h3>
                  <div className="space-y-3">
                    {result.memories.map((mem, i) => (
                      <div
                        key={i}
                        className={`border rounded-lg p-3 transition-colors ${
                          selectedMemories.has(i)
                            ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950"
                            : "border-zinc-200 dark:border-zinc-700 opacity-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedMemories.has(i)}
                            onChange={() => toggleMemory(i)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">
                                {mem.type}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded ${confidenceBadgeColor(mem.confidenceLevel)}`}>
                                {mem.confidenceLevel} ({mem.confidenceScore.toFixed(2)})
                              </span>
                              {mem.existingMemoryId && (
                                <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                                  supersedes {mem.existingMemoryId.slice(0, 12)}...
                                </span>
                              )}
                            </div>
                            <textarea
                              value={editedMemories.get(i)?.content ?? mem.content}
                              onChange={(e) => updateMemoryContent(i, e.target.value)}
                              className="w-full text-sm bg-transparent border-none outline-none resize-none"
                              rows={2}
                            />
                            <p className="text-xs text-zinc-400 mt-1 italic">
                              &ldquo;{mem.evidence.slice(0, 150)}&rdquo;
                            </p>
                            {mem.tags.length > 0 && (
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {mem.tags.map((tag) => (
                                  <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Questions */}
              {result.questions.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3">
                    Generated Questions ({selectedQuestions.size}/{result.questions.length})
                  </h3>
                  <div className="space-y-2">
                    {result.questions.map((q, i) => (
                      <div
                        key={i}
                        className={`border rounded-lg p-3 transition-colors ${
                          selectedQuestions.has(i)
                            ? "border-blue-300 dark:border-blue-700"
                            : "border-zinc-200 dark:border-zinc-700 opacity-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedQuestions.has(i)}
                            onChange={() => toggleQuestion(i)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{q.content}</p>
                            <p className="text-xs text-zinc-500 mt-1">{q.context}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                {q.curiosityType}
                              </span>
                              <span className="text-xs text-zinc-400">{q.timing}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.memories.length === 0 && result.questions.length === 0 && (
                <p className="text-center text-zinc-500 py-4">No memories or questions extracted from this conversation.</p>
              )}
            </div>
          )}

          {phase === "saving" && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-zinc-600 dark:text-zinc-400">Saving approved items...</p>
            </div>
          )}

          {phase === "done" && (
            <div className="text-center py-8">
              <p className="text-lg font-medium text-green-600 mb-2">Extraction complete</p>
              <p className="text-zinc-500">
                Memories and questions have been saved.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        {phase === "reviewing" && result && (selectedMemories.size > 0 || selectedQuestions.size > 0) && (
          <div className="border-t border-zinc-200 dark:border-zinc-700 px-6 py-4 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-800 dark:text-zinc-400"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save {selectedMemories.size} memories &amp; {selectedQuestions.size} questions
            </button>
          </div>
        )}

        {phase === "done" && (
          <div className="border-t border-zinc-200 dark:border-zinc-700 px-6 py-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
