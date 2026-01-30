"use client";
import { useState, useEffect, useCallback } from "react";

export interface TagValue {
  id: string;
  name: string;
}

export interface TagCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  allowCustom: boolean;
  values: TagValue[];
}

export interface EntityType {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
}

export interface KnowledgeConfig {
  tagCategories: TagCategory[];
  entityTypes: EntityType[];
}

export interface GraphStats {
  totalEntities: number;
  byType: Record<string, number>;  // { fact: 10, note: 5, person: 3, ... }
  totalTags: number;
  topTags: Array<{ tag: string; count: number }>;
  topEntities: Array<{ id: string; name: string; type: string; count: number }>;
  untaggedEntities: number;
}

export function useKnowledge() {
  const [config, setConfig] = useState<KnowledgeConfig | null>(null);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    const res = await fetch("/api/knowledge/config");
    if (res.ok) {
      setConfig(await res.json());
    }
  }, []);

  const fetchStats = useCallback(async () => {
    const res = await fetch("/api/knowledge/stats");
    if (res.ok) {
      setStats(await res.json());
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchConfig(), fetchStats()]).finally(() => setIsLoading(false));
  }, [fetchConfig, fetchStats]);

  const addCategory = async (category: TagCategory) => {
    const res = await fetch("/api/knowledge/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(category),
    });
    if (res.ok) await fetchConfig();
    return res.ok;
  };

  const updateCategory = async (categoryId: string, updates: Partial<TagCategory>) => {
    const res = await fetch(`/api/knowledge/tags/${categoryId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) await fetchConfig();
    return res.ok;
  };

  const deleteCategory = async (categoryId: string) => {
    const res = await fetch(`/api/knowledge/tags/${categoryId}`, {
      method: "DELETE",
    });
    if (res.ok) await fetchConfig();
    return res.ok;
  };

  const addTagValue = async (categoryId: string, value: TagValue) => {
    const res = await fetch(`/api/knowledge/tags/${categoryId}/values`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    if (res.ok) await fetchConfig();
    return res.ok;
  };

  const removeTagValue = async (categoryId: string, valueId: string) => {
    const res = await fetch(`/api/knowledge/tags/${categoryId}/values`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valueId }),
    });
    if (res.ok) await fetchConfig();
    return res.ok;
  };

  const setEntityTypeEnabled = async (typeId: string, enabled: boolean) => {
    const res = await fetch("/api/knowledge/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...config,
        entityTypes: config?.entityTypes.map(t =>
          t.id === typeId ? { ...t, enabled } : t
        ),
      }),
    });
    if (res.ok) await fetchConfig();
    return res.ok;
  };

  return {
    config,
    stats,
    isLoading,
    addCategory,
    updateCategory,
    deleteCategory,
    addTagValue,
    removeTagValue,
    setEntityTypeEnabled,
    refetchConfig: fetchConfig,
    refetchStats: fetchStats,
  };
}
