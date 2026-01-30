"use client";

import { EntityBrowser } from "@/components/knowledge/EntityBrowser";
import { useEntities } from "@/hooks/useEntities";
import Link from "next/link";

export default function EntitiesPage() {
  const {
    entities,
    isLoading,
    typeFilter,
    setTypeFilter,
    updateEntity,
    deleteEntity,
  } = useEntities();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-dark">
        <Link href="/settings/knowledge" className="hover:text-foreground">
          Knowledge
        </Link>
        <span>/</span>
        <span>Entities</span>
      </div>

      <EntityBrowser
        entities={entities}
        isLoading={isLoading}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        onUpdateEntity={updateEntity}
        onDeleteEntity={deleteEntity}
      />
    </div>
  );
}
