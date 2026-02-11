"use client";

import { useState } from "react";
import { useQuestions } from "@/hooks/useQuestions";
import type { QuestionStatus } from "@/types/memory";

const CURIOSITY_COLORS: Record<string, string> = {
  gap: "bg-amber-500/20 text-amber-400",
  implication: "bg-blue-500/20 text-blue-400",
  clarification: "bg-purple-500/20 text-purple-400",
  exploration: "bg-green-500/20 text-green-400",
  connection: "bg-cyan-500/20 text-cyan-400",
};

export function QuestionsTab() {
  const [statusFilter, setStatusFilter] = useState<QuestionStatus | "">("");
  const { questions, isLoading, resolveQuestion, deleteQuestion, isResolving } = useQuestions(
    statusFilter ? { status: statusFilter } : {}
  );
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");

  const handleResolve = async (id: string) => {
    if (!answer.trim()) return;
    await resolveQuestion(id, answer);
    setResolvingId(null);
    setAnswer("");
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Delete this question?")) {
      await deleteQuestion(id);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as QuestionStatus | "")}
          className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted-dark">Loading questions...</div>
      ) : questions.length === 0 ? (
        <div className="p-8 text-center">
          <span className="label-dark">{"// NO_QUESTIONS"}</span>
          <p className="text-sm text-muted-dark mt-2">No questions yet.</p>
        </div>
      ) : (
        <div>
          {questions.map((q) => (
            <div key={q.id} className="border-b border-border px-4 py-3 space-y-2">
              <div className="flex items-start gap-3">
                <span className={`text-[10px] mono px-1.5 py-0.5 rounded ${CURIOSITY_COLORS[q.curiosityType] ?? "bg-gray-500/20 text-gray-400"}`}>
                  {q.curiosityType}
                </span>
                <div className="flex-1">
                  <p className="text-sm text-foreground">{q.content}</p>
                  <p className="text-xs text-muted-dark mt-1">{q.context}</p>
                </div>
                <span className={`text-[10px] mono px-1.5 py-0.5 rounded ${q.status === "resolved" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                  {q.status}
                </span>
              </div>

              {q.status === "resolved" && q.answer && (
                <div className="ml-12 text-xs text-muted-dark">
                  Answer: {q.answer}
                </div>
              )}

              <div className="flex gap-2 ml-12">
                {q.status === "pending" && (
                  resolvingId === q.id ? (
                    <div className="flex gap-2 items-center w-full">
                      <input
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="Answer..."
                        className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
                        autoFocus
                      />
                      <button
                        onClick={() => handleResolve(q.id)}
                        disabled={isResolving}
                        className="text-xs text-green-400 hover:text-green-300"
                      >
                        {isResolving ? "..." : "Submit"}
                      </button>
                      <button
                        onClick={() => { setResolvingId(null); setAnswer(""); }}
                        className="text-xs text-muted-dark hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setResolvingId(q.id)}
                      className="text-xs text-muted-dark hover:text-foreground transition-colors"
                    >
                      Resolve
                    </button>
                  )
                )}
                <button
                  onClick={() => handleDelete(q.id)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
