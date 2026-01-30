"use client";

import { useState } from "react";
import { KnowledgeSettings } from "@/components/settings/KnowledgeSettings";
import { TagCategoryEditor } from "@/components/settings/TagCategoryEditor";
import { useKnowledge, type TagCategory } from "@/hooks/useKnowledge";

export default function KnowledgeSettingsPage() {
  const {
    config,
    stats,
    isLoading,
    addCategory,
    updateCategory,
    deleteCategory,
    addTagValue,
    removeTagValue,
    setEntityTypeEnabled,
  } = useKnowledge();

  const [editingCategory, setEditingCategory] = useState<TagCategory | null>(null);

  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-muted-dark">Loading...</span>
      </div>
    );
  }

  if (editingCategory) {
    return (
      <TagCategoryEditor
        category={editingCategory}
        isNew={!editingCategory.id}
        onSave={async (category) => {
          if (editingCategory.id) {
            await updateCategory(editingCategory.id, category);
          } else {
            await addCategory(category);
          }
          setEditingCategory(null);
        }}
        onCancel={() => setEditingCategory(null)}
        onAddValue={addTagValue}
        onRemoveValue={removeTagValue}
      />
    );
  }

  return (
    <KnowledgeSettings
      tagCategories={config.tagCategories}
      entityTypes={config.entityTypes}
      stats={stats}
      onAddCategory={addCategory}
      onUpdateCategory={updateCategory}
      onDeleteCategory={deleteCategory}
      onAddTagValue={addTagValue}
      onRemoveTagValue={removeTagValue}
      onSetEntityTypeEnabled={setEntityTypeEnabled}
      onEditCategory={setEditingCategory}
    />
  );
}
