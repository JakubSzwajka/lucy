"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client/api/client";
import { queryKeys } from "@/lib/client/query/keys";
import type { Question, QuestionStatus, QuestionTiming } from "@/types/memory";

interface QuestionFilters {
  status?: QuestionStatus;
  timing?: QuestionTiming;
}

function buildParams(filters: QuestionFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.status) params.status = filters.status;
  if (filters.timing) params.timing = filters.timing;
  return params;
}

export function useQuestions(filters: QuestionFilters = {}) {
  const qc = useQueryClient();
  const params = buildParams(filters);

  const { data: questions = [], isLoading } = useQuery({
    queryKey: queryKeys.questions.list(params),
    queryFn: () => api.listQuestions(Object.keys(params).length ? params : undefined) as unknown as Promise<Question[]>,
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, answer }: { id: string; answer: string }) => api.resolveQuestion(id, answer),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.questions.all });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteQuestion(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.questions.all });
    },
  });

  return {
    questions,
    isLoading,
    resolveQuestion: (id: string, answer: string) => resolveMutation.mutateAsync({ id, answer }),
    deleteQuestion: deleteMutation.mutateAsync,
    isResolving: resolveMutation.isPending,
  };
}
