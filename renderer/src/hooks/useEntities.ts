"use client";

import { useState, useEffect, useCallback } from "react";

export interface Entity {
  id: string;
  type: string;
  name: string;
  aliases: string[];
  description?: string;
  content?: string;  // For facts and notes
  tags: string[];
  relations: string[];
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export function useEntities() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const fetchEntities = useCallback(async () => {
    setIsLoading(true);
    const url = typeFilter
      ? `/api/knowledge/entities?type=${typeFilter}`
      : "/api/knowledge/entities";
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setEntities(data.entities || []);
    }
    setIsLoading(false);
  }, [typeFilter]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  const updateEntity = async (id: string, updates: Partial<Entity>) => {
    const res = await fetch(`/api/knowledge/entities/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) await fetchEntities();
    return res.ok;
  };

  const deleteEntity = async (id: string) => {
    const res = await fetch(`/api/knowledge/entities/${id}`, {
      method: "DELETE",
    });
    if (res.ok) await fetchEntities();
    return res.ok;
  };

  return {
    entities,
    isLoading,
    typeFilter,
    setTypeFilter,
    updateEntity,
    deleteEntity,
    refetch: fetchEntities,
  };
}
