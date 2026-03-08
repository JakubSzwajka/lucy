import type { ModelDef } from "@/api/types";

interface ModelSelectorProps {
  models: ModelDef[];
  value: string;
  onChange: (modelId: string) => void;
}

export function ModelSelector({ models, value, onChange }: ModelSelectorProps) {
  if (models.length === 0) {
    return (
      <span className="text-sm font-mono text-muted-foreground">Loading models...</span>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-background border border-border rounded-md px-2 py-1 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
    >
      {models.map((model) => (
        <option key={model.id} value={model.id}>
          {model.name}
        </option>
      ))}
    </select>
  );
}
