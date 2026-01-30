"use client";

import Link from "next/link";
import type { TagCategory, EntityType, GraphStats } from "@/hooks/useKnowledge";

interface KnowledgeSettingsProps {
  tagCategories: TagCategory[];
  entityTypes: EntityType[];
  stats: GraphStats | null;
  onAddCategory: (category: TagCategory) => Promise<boolean>;
  onUpdateCategory: (id: string, updates: Partial<TagCategory>) => Promise<boolean>;
  onDeleteCategory: (id: string) => Promise<boolean>;
  onAddTagValue: (categoryId: string, value: { id: string; name: string }) => Promise<boolean>;
  onRemoveTagValue: (categoryId: string, valueId: string) => Promise<boolean>;
  onSetEntityTypeEnabled: (typeId: string, enabled: boolean) => Promise<boolean>;
  onEditCategory: (category: TagCategory) => void;
}

const TYPE_LABELS: Record<string, string> = {
  fact: "Facts",
  note: "Notes",
  person: "People",
  place: "Places",
  organization: "Organizations",
  project: "Projects",
  concept: "Concepts",
  event: "Events",
};

export function KnowledgeSettings({
  tagCategories,
  entityTypes,
  stats,
  onDeleteCategory,
  onSetEntityTypeEnabled,
  onEditCategory,
}: KnowledgeSettingsProps) {
  const handleDeleteCategory = async (category: TagCategory) => {
    if (confirm(`Delete tag category "${category.name}"? This cannot be undone.`)) {
      await onDeleteCategory(category.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tag Categories Section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="label">Tag Categories</h2>
          <button
            onClick={() => onEditCategory({
              id: "",
              name: "",
              description: "",
              color: "#3B82F6",
              allowCustom: false,
              values: [],
            })}
            className="text-xs text-muted-dark hover:text-foreground"
          >
            + Add Category
          </button>
        </div>
        <p className="text-xs text-muted-dark mb-4">
          Define tag vocabulary to organize your knowledge graph.
        </p>

        {tagCategories.length === 0 ? (
          <div className="border border-border border-dashed rounded p-8 text-center">
            <p className="text-sm text-muted-dark">No tag categories defined</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tagCategories.map((category) => (
              <div
                key={category.id}
                className="border border-border rounded p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{category.name}</span>
                        <span className="text-xs text-muted-dark">
                          ({category.values.length} values)
                        </span>
                        {category.allowCustom && (
                          <span className="text-xs text-green-500">custom allowed</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-dark mt-0.5">
                        {category.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEditCategory(category)}
                      className="text-xs text-muted-dark hover:text-foreground"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category)}
                      className="text-xs text-muted-dark hover:text-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {category.values.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border">
                    {category.values.map((value) => (
                      <span
                        key={value.id}
                        className="px-2 py-0.5 text-xs rounded-full"
                        style={{
                          backgroundColor: category.color + "20",
                          color: category.color,
                        }}
                      >
                        {value.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Entity Types Section */}
      <section>
        <h2 className="label mb-3">Entity Types</h2>
        <p className="text-xs text-muted-dark mb-4">
          Enable entity types for the AI to extract and track. Facts and Notes are always enabled.
        </p>
        <div className="border border-border rounded p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {entityTypes.map((type) => {
              const isContentType = type.id === "fact" || type.id === "note";
              return (
                <label
                  key={type.id}
                  className={`flex items-center gap-2 ${isContentType ? "opacity-60" : "cursor-pointer"}`}
                >
                  <input
                    type="checkbox"
                    checked={type.enabled}
                    onChange={(e) => onSetEntityTypeEnabled(type.id, e.target.checked)}
                    disabled={isContentType}
                    className="w-4 h-4 rounded border-border bg-background-secondary accent-foreground disabled:opacity-50"
                  />
                  <span className="text-sm">{type.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      {stats && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="label">Knowledge Graph</h2>
            <Link
              href="/settings/knowledge/entities"
              className="text-xs text-muted-dark hover:text-foreground"
            >
              Browse All →
            </Link>
          </div>
          <div className="border border-border rounded p-4">
            {/* Entity counts by type */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(stats.byType || {}).map(([type, count]) => (
                <div key={type} className="text-center">
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs text-muted-dark">{TYPE_LABELS[type] || type}</div>
                </div>
              ))}
              {Object.keys(stats.byType || {}).length === 0 && (
                <div className="col-span-4 text-center text-sm text-muted-dark py-4">
                  No entities yet. Start chatting to create facts and notes.
                </div>
              )}
            </div>

            {/* Summary stats */}
            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border text-xs text-muted-dark">
              <span>{stats.totalEntities} total entities</span>
              <span>•</span>
              <span>{stats.totalTags} unique tags</span>
              {stats.untaggedEntities > 0 && (
                <>
                  <span>•</span>
                  <span>{stats.untaggedEntities} untagged</span>
                </>
              )}
            </div>

            {/* Top Tags */}
            {stats.topTags && stats.topTags.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-xs text-muted-dark mb-2">Top Tags</div>
                <div className="flex flex-wrap gap-2">
                  {stats.topTags.slice(0, 5).map((t) => (
                    <span
                      key={t.tag}
                      className="px-2 py-1 text-xs bg-background-secondary rounded"
                    >
                      {t.tag} ({t.count})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Most Connected */}
            {stats.topEntities && stats.topEntities.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-xs text-muted-dark mb-2">Most Connected</div>
                <div className="flex flex-wrap gap-2">
                  {stats.topEntities.slice(0, 5).map((e) => (
                    <span
                      key={e.id}
                      className="px-2 py-1 text-xs bg-background-secondary rounded"
                    >
                      {e.name} <span className="text-muted-dark">({e.type})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
