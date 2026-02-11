"use client";

import { useState } from "react";

interface TagValue {
  id: string;
  name: string;
}

interface TagCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  allowCustom: boolean;
  values: TagValue[];
}

interface TagCategoryEditorProps {
  category: TagCategory;
  isNew: boolean;
  onSave: (category: TagCategory) => Promise<void>;
  onCancel: () => void;
  onAddValue: (categoryId: string, value: TagValue) => Promise<boolean>;
  onRemoveValue: (categoryId: string, valueId: string) => Promise<boolean>;
}

const COLOR_OPTIONS = [
  { value: "#3B82F6", label: "Blue" },
  { value: "#10B981", label: "Green" },
  { value: "#F59E0B", label: "Amber" },
  { value: "#EF4444", label: "Red" },
  { value: "#8B5CF6", label: "Purple" },
  { value: "#EC4899", label: "Pink" },
  { value: "#6B7280", label: "Gray" },
];

export function TagCategoryEditor({
  category,
  isNew,
  onSave,
  onCancel,
  onAddValue,
  onRemoveValue,
}: TagCategoryEditorProps) {
  const [formData, setFormData] = useState<TagCategory>({
    ...category,
    id: category.id || "",
    values: [...category.values],
  });
  const [newValueName, setNewValueName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate ID from name for new categories inline during name changes
  const handleNameChange = (name: string) => {
    if (isNew) {
      const id = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      setFormData((prev) => ({ ...prev, name, id }));
    } else {
      setFormData((prev) => ({ ...prev, name }));
    }
  };

  const handleAddValue = async () => {
    if (!newValueName.trim()) return;

    const valueId = newValueName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Check for duplicates
    if (formData.values.some((v) => v.id === valueId)) {
      setError("A value with this ID already exists");
      return;
    }

    const newValue = { id: valueId, name: newValueName.trim() };

    // If editing existing category, save to server
    if (!isNew && formData.id) {
      await onAddValue(formData.id, newValue);
    }

    setFormData((prev) => ({
      ...prev,
      values: [...prev.values, newValue],
    }));
    setNewValueName("");
    setError(null);
  };

  const handleRemoveValue = async (valueId: string) => {
    // If editing existing category, remove from server
    if (!isNew && formData.id) {
      await onRemoveValue(formData.id, valueId);
    }

    setFormData((prev) => ({
      ...prev,
      values: prev.values.filter((v) => v.id !== valueId),
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }

    if (!formData.id) {
      setError("ID is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="label">
          {isNew ? "Add Tag Category" : `Edit "${category.name}"`}
        </h2>
        <button
          onClick={onCancel}
          className="text-xs text-muted-dark hover:text-foreground"
        >
          Cancel
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Category Details */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-muted-dark mb-1">Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g., Topic, Project, Status"
            className="w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-foreground"
          />
        </div>

        <div>
          <label className="block text-xs text-muted-dark mb-1">ID</label>
          <input
            type="text"
            value={formData.id}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, id: e.target.value }))
            }
            disabled={!isNew}
            placeholder="auto-generated from name"
            className="w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-foreground disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-xs text-muted-dark mb-1">Description</label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="Brief description of this category"
            className="w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-foreground"
          />
        </div>

        <div>
          <label className="block text-xs text-muted-dark mb-1">Color</label>
          <div className="flex gap-2">
            {COLOR_OPTIONS.map((color) => (
              <button
                key={color.value}
                onClick={() =>
                  setFormData((prev) => ({ ...prev, color: color.value }))
                }
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  formData.color === color.value
                    ? "border-foreground scale-110"
                    : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: color.value }}
                title={color.label}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.allowCustom}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, allowCustom: e.target.checked }))
              }
              className="w-4 h-4 rounded border-border bg-background-secondary accent-foreground"
            />
            <span className="text-sm">Allow AI to create custom values</span>
          </label>
          <p className="text-xs text-muted-dark mt-1 ml-6">
            When enabled, AI can add new values to this category beyond the predefined list.
          </p>
        </div>
      </div>

      {/* Values Section */}
      <div className="border-t border-border pt-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs text-muted-dark">Values</label>
          <span className="text-xs text-muted-dark">
            {formData.values.length} value{formData.values.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Add new value */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newValueName}
            onChange={(e) => setNewValueName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddValue()}
            placeholder="Add a value (e.g., Finance, Personal)"
            className="flex-1 bg-background-secondary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-foreground"
          />
          <button
            onClick={handleAddValue}
            disabled={!newValueName.trim()}
            className="px-3 py-2 text-xs border border-border rounded hover:bg-background-secondary disabled:opacity-50"
          >
            Add
          </button>
        </div>

        {/* Values list */}
        {formData.values.length === 0 ? (
          <div className="border border-border border-dashed rounded p-4 text-center">
            <p className="text-xs text-muted-dark">No values defined yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {formData.values.map((value) => (
              <div
                key={value.id}
                className="flex items-center justify-between px-3 py-2 bg-background-secondary rounded"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: formData.color }}
                  />
                  <span className="text-sm">{value.name}</span>
                  <span className="text-xs text-muted-dark">({value.id})</span>
                </div>
                <button
                  onClick={() => handleRemoveValue(value.id)}
                  className="text-xs text-muted-dark hover:text-red-500"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-xs border border-border rounded hover:bg-background-secondary"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 text-xs bg-foreground text-background rounded hover:opacity-90 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : isNew ? "Create Category" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
