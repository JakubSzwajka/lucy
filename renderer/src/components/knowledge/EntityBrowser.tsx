"use client";

import { useState } from "react";
import type { Entity } from "@/hooks/useEntities";

interface EntityBrowserProps {
  entities: Entity[];
  isLoading: boolean;
  typeFilter: string | null;
  onTypeFilterChange: (type: string | null) => void;
  onUpdateEntity: (id: string, updates: Partial<Entity>) => Promise<boolean>;
  onDeleteEntity: (id: string) => Promise<boolean>;
}

const ENTITY_TYPE_ICONS: Record<string, string> = {
  fact: "⚡",
  note: "📄",
  person: "👤",
  place: "📍",
  organization: "🏢",
  project: "📁",
  concept: "💡",
  event: "📅",
};

const ENTITY_TYPES = ["fact", "note", "person", "place", "organization", "project", "concept", "event"];

export function EntityBrowser({
  entities,
  isLoading,
  typeFilter,
  onTypeFilterChange,
  onUpdateEntity,
  onDeleteEntity,
}: EntityBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);

  // Filter entities by search query
  const filteredEntities = entities.filter((entity) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      entity.name.toLowerCase().includes(query) ||
      entity.aliases.some((a) => a.toLowerCase().includes(query)) ||
      entity.description?.toLowerCase().includes(query) ||
      entity.content?.toLowerCase().includes(query) ||
      entity.tags?.some((t) => t.toLowerCase().includes(query))
    );
  });

  const handleDelete = async (entity: Entity) => {
    if (confirm(`Delete entity "${entity.name}"? This cannot be undone.`)) {
      await onDeleteEntity(entity.id);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingEntity) return;
    await onUpdateEntity(editingEntity.id, {
      name: editingEntity.name,
      aliases: editingEntity.aliases,
      description: editingEntity.description,
      content: editingEntity.content,
      tags: editingEntity.tags,
    });
    setEditingEntity(null);
  };

  // Check if entity type supports content field
  const hasContent = (type: string) => type === "fact" || type === "note";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-muted-dark">Loading entities...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with search and filter */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entities..."
            className="w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-foreground"
          />
        </div>
        <select
          value={typeFilter || ""}
          onChange={(e) => onTypeFilterChange(e.target.value || null)}
          className="bg-background-secondary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-foreground"
        >
          <option value="">All Types</option>
          {ENTITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {ENTITY_TYPE_ICONS[type]} {type.charAt(0).toUpperCase() + type.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Entity count */}
      <div className="text-xs text-muted-dark">
        {filteredEntities.length} entit{filteredEntities.length !== 1 ? "ies" : "y"}
        {typeFilter && ` of type "${typeFilter}"`}
        {searchQuery && ` matching "${searchQuery}"`}
      </div>

      {/* Entity list */}
      {filteredEntities.length === 0 ? (
        <div className="border border-border border-dashed rounded p-8 text-center">
          <p className="text-sm text-muted-dark">
            {entities.length === 0
              ? "No entities created yet. Entities will be extracted when you save notes or memories."
              : "No entities match your search."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEntities.map((entity) => (
            <div
              key={entity.id}
              className="border border-border rounded overflow-hidden"
            >
              {/* Entity header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-background-secondary"
                onClick={() =>
                  setExpandedEntity(
                    expandedEntity === entity.id ? null : entity.id
                  )
                }
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {ENTITY_TYPE_ICONS[entity.type] || "📌"}
                  </span>
                  <div>
                    <div className="font-medium text-sm">{entity.name}</div>
                    <div className="text-xs text-muted-dark">
                      {entity.type}
                      {entity.aliases.length > 0 && (
                        <span> · {entity.aliases.length} alias{entity.aliases.length !== 1 ? "es" : ""}</span>
                      )}
                      {entity.tags?.length > 0 && (
                        <span> · {entity.tags.length} tag{entity.tags.length !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </div>
                </div>
                <svg
                  className={`w-4 h-4 text-muted-dark transition-transform ${
                    expandedEntity === entity.id ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>

              {/* Expanded details */}
              {expandedEntity === entity.id && (
                <div className="border-t border-border p-4 bg-background-secondary/50">
                  {editingEntity?.id === entity.id ? (
                    // Edit mode
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-muted-dark mb-1">Name</label>
                        <input
                          type="text"
                          value={editingEntity.name}
                          onChange={(e) =>
                            setEditingEntity({ ...editingEntity, name: e.target.value })
                          }
                          className="w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-dark mb-1">
                          Aliases (comma-separated)
                        </label>
                        <input
                          type="text"
                          value={editingEntity.aliases.join(", ")}
                          onChange={(e) =>
                            setEditingEntity({
                              ...editingEntity,
                              aliases: e.target.value.split(",").map((a) => a.trim()).filter(Boolean),
                            })
                          }
                          className="w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-dark mb-1">Description</label>
                        <input
                          type="text"
                          value={editingEntity.description || ""}
                          onChange={(e) =>
                            setEditingEntity({ ...editingEntity, description: e.target.value })
                          }
                          className="w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm"
                        />
                      </div>
                      {hasContent(editingEntity.type) && (
                        <div>
                          <label className="block text-xs text-muted-dark mb-1">Content</label>
                          <textarea
                            value={editingEntity.content || ""}
                            onChange={(e) =>
                              setEditingEntity({ ...editingEntity, content: e.target.value })
                            }
                            rows={4}
                            className="w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm resize-none"
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-xs text-muted-dark mb-1">
                          Tags (comma-separated)
                        </label>
                        <input
                          type="text"
                          value={editingEntity.tags?.join(", ") || ""}
                          onChange={(e) =>
                            setEditingEntity({
                              ...editingEntity,
                              tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                            })
                          }
                          className="w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          className="px-3 py-1.5 text-xs bg-foreground text-background rounded hover:opacity-90"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingEntity(null)}
                          className="px-3 py-1.5 text-xs border border-border rounded hover:bg-background-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div className="space-y-3">
                      {entity.description && (
                        <p className="text-sm text-muted-dark">{entity.description}</p>
                      )}

                      {/* Content preview for facts and notes */}
                      {hasContent(entity.type) && entity.content && (
                        <div>
                          <div className="text-xs text-muted-dark mb-1">Content</div>
                          <div className="p-3 bg-background-secondary rounded text-sm whitespace-pre-wrap">
                            {entity.content}
                          </div>
                        </div>
                      )}

                      {entity.aliases.length > 0 && (
                        <div>
                          <div className="text-xs text-muted-dark mb-1">Aliases</div>
                          <div className="flex flex-wrap gap-1">
                            {entity.aliases.map((alias, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 text-xs bg-background-secondary rounded"
                              >
                                {alias}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {entity.tags?.length > 0 && (
                        <div>
                          <div className="text-xs text-muted-dark mb-1">Tags</div>
                          <div className="flex flex-wrap gap-1">
                            {entity.tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 text-xs bg-blue-500/10 text-blue-400 rounded"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {entity.relations?.length > 0 && (
                        <div>
                          <div className="text-xs text-muted-dark mb-1">Relations</div>
                          <div className="flex flex-wrap gap-1">
                            {entity.relations.map((relation, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 text-xs bg-purple-500/10 text-purple-400 rounded"
                              >
                                {relation}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-muted-dark">
                        Created: {new Date(entity.createdAt).toLocaleDateString()}
                        {entity.updatedAt !== entity.createdAt && (
                          <span> · Updated: {new Date(entity.updatedAt).toLocaleDateString()}</span>
                        )}
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => setEditingEntity(entity)}
                          className="text-xs text-muted-dark hover:text-foreground"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(entity)}
                          className="text-xs text-muted-dark hover:text-red-500"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
