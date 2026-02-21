"use client";

import { useEffect, useState } from "react";
import type {
  AgentConfigWithTools,
  AgentConfigCreate,
  AgentConfigUpdate,
  SystemPrompt,
  ModelConfig,
  McpServer,
} from "@/types";

interface AgentConfigEditorProps {
  config: AgentConfigWithTools | null;
  configs: AgentConfigWithTools[];
  systemPrompts: SystemPrompt[];
  models: ModelConfig[];
  mcpServers: McpServer[];
  isNew: boolean;
  onSave: (data: AgentConfigCreate | AgentConfigUpdate) => Promise<void>;
  onDelete: () => Promise<void>;
  onCancel: () => void;
}

const BUILTIN_MODULES = [
  { id: "continuity", label: "Memory" },
  { id: "plan", label: "Planning" },
];

export function AgentConfigEditor({
  config,
  configs,
  systemPrompts,
  models,
  mcpServers,
  isNew,
  onSave,
  onDelete,
  onCancel,
}: AgentConfigEditorProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPromptId, setSystemPromptId] = useState<string>("");
  const [defaultModelId, setDefaultModelId] = useState<string>("");
  const [maxTurns, setMaxTurns] = useState(25);
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [builtinModules, setBuiltinModules] = useState<string[]>([]);
  const [selectedMcpServerIds, setSelectedMcpServerIds] = useState<string[]>([]);
  const [selectedDelegateIds, setSelectedDelegateIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Other configs available for delegation (exclude self)
  const otherConfigs = configs.filter((c) => c.id !== config?.id);

  useEffect(() => {
    if (config) {
      setName(config.name);
      setDescription(config.description ?? "");
      setSystemPromptId(config.systemPromptId ?? "");
      setDefaultModelId(config.defaultModelId ?? "");
      setMaxTurns(config.maxTurns);
      setIcon(config.icon ?? "");
      setColor(config.color ?? "");
      setIsDefault(config.isDefault);
      setBuiltinModules(
        config.tools.filter((t) => t.toolType === "builtin").map((t) => t.toolRef)
      );
      setSelectedMcpServerIds(
        config.tools.filter((t) => t.toolType === "mcp").map((t) => t.toolRef)
      );
      setSelectedDelegateIds(
        config.tools.filter((t) => t.toolType === "delegate").map((t) => t.toolRef)
      );
    } else {
      setName("");
      setDescription("");
      setSystemPromptId("");
      setDefaultModelId("");
      setMaxTurns(25);
      setIcon("");
      setColor("");
      setIsDefault(false);
      setBuiltinModules([]);
      setSelectedMcpServerIds([]);
      setSelectedDelegateIds([]);
    }
    setShowDeleteConfirm(false);
  }, [config]);

  const toggleBuiltin = (mod: string) => {
    setBuiltinModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  const toggleMcpServer = (id: string) => {
    setSelectedMcpServerIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleDelegate = (id: string) => {
    setSelectedDelegateIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const buildTools = () => {
    const tools: { type: "mcp" | "builtin" | "delegate"; ref: string }[] = [];
    for (const mod of builtinModules) {
      tools.push({ type: "builtin", ref: mod });
    }
    for (const id of selectedMcpServerIds) {
      tools.push({ type: "mcp", ref: id });
    }
    for (const id of selectedDelegateIds) {
      tools.push({ type: "delegate", ref: id });
    }
    return tools;
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setIsSaving(true);
    try {
      await onSave({
        name: trimmedName,
        description: description.trim() || undefined,
        systemPromptId: systemPromptId || undefined,
        defaultModelId: defaultModelId || undefined,
        maxTurns,
        icon: icon.trim() || undefined,
        color: color.trim() || undefined,
        isDefault,
        tools: buildTools(),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!config && !isNew) {
    return (
      <div className="flex items-center justify-center h-full text-muted-dark">
        <p className="text-sm">Select an agent config or create a new one</p>
      </div>
    );
  }

  const selectClass =
    "w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-muted-darker appearance-none";
  const inputClass =
    "w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-muted-darker";

  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto">
      {/* Name */}
      <div className="mb-4">
        <label className="label-dark block mb-2">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Research Agent"
          className={inputClass}
        />
      </div>

      {/* Description */}
      <div className="mb-4">
        <label className="label-dark block mb-2">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this agent configuration does..."
          rows={2}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* System Prompt - Select from existing */}
      <div className="mb-4">
        <label className="label-dark block mb-2">System Prompt</label>
        <select
          value={systemPromptId}
          onChange={(e) => setSystemPromptId(e.target.value)}
          className={selectClass}
        >
          <option value="">None</option>
          {systemPrompts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-dark mt-1">
          Select from your saved system prompts
        </p>
      </div>

      {/* Model + Max Turns */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="label-dark block mb-2">Model</label>
          <select
            value={defaultModelId}
            onChange={(e) => setDefaultModelId(e.target.value)}
            className={selectClass}
          >
            <option value="">Use default</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-dark block mb-2">Max Turns</label>
          <input
            type="number"
            value={maxTurns}
            onChange={(e) => setMaxTurns(Number(e.target.value) || 25)}
            min={1}
            max={100}
            className={inputClass}
          />
        </div>
      </div>

      {/* Icon + Color */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="label-dark block mb-2">Icon</label>
          <input
            type="text"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="e.g., an emoji"
            className={inputClass}
          />
        </div>
        <div>
          <label className="label-dark block mb-2">Color</label>
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="e.g., #4f46e5"
            className={inputClass}
          />
        </div>
      </div>

      {/* Default toggle */}
      <div className="mb-4">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="rounded border-border bg-background-secondary"
          />
          Default Config
        </label>
        <p className="text-xs text-muted-dark mt-1">
          New sessions will use this config by default
        </p>
      </div>

      {/* Tools */}
      <div className="mb-4 border border-border rounded p-3">
        <span className="label-dark block mb-3">Tools</span>

        {/* Builtin Modules */}
        <div className="mb-4">
          <span className="text-xs text-muted-dark uppercase tracking-wide block mb-2">
            Builtin Modules
          </span>
          <div className="flex flex-wrap gap-3">
            {BUILTIN_MODULES.map((mod) => (
              <label key={mod.id} className="flex items-center gap-1.5 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={builtinModules.includes(mod.id)}
                  onChange={() => toggleBuiltin(mod.id)}
                  className="rounded border-border bg-background-secondary"
                />
                {mod.label}
              </label>
            ))}
          </div>
        </div>

        {/* MCP Servers */}
        <div className="mb-4">
          <span className="text-xs text-muted-dark uppercase tracking-wide block mb-2">
            MCP Servers
          </span>
          {mcpServers.length === 0 ? (
            <p className="text-xs text-muted-darker">No MCP servers configured</p>
          ) : (
            <div className="flex flex-col gap-2">
              {mcpServers.map((server) => (
                <label key={server.id} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={selectedMcpServerIds.includes(server.id)}
                    onChange={() => toggleMcpServer(server.id)}
                    className="rounded border-border bg-background-secondary"
                  />
                  <span>{server.name}</span>
                  {!server.enabled && (
                    <span className="text-[10px] text-muted-darker">(disabled)</span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Delegate Agents */}
        <div>
          <span className="text-xs text-muted-dark uppercase tracking-wide block mb-2">
            Delegate Agents
          </span>
          {otherConfigs.length === 0 ? (
            <p className="text-xs text-muted-darker">No other agent configs available</p>
          ) : (
            <div className="flex flex-col gap-2">
              {otherConfigs.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={selectedDelegateIds.includes(c.id)}
                    onChange={() => toggleDelegate(c.id)}
                    className="rounded border-border bg-background-secondary"
                  />
                  <span>
                    {c.icon && <span className="mr-1">{c.icon}</span>}
                    {c.name}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border flex-shrink-0">
        <div className="flex gap-2">
          {!isNew && (
            <>
              {showDeleteConfirm ? (
                <>
                  <span className="text-xs text-muted-dark mr-2">Are you sure?</span>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="text-xs px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDeleting ? "Deleting..." : "Yes, Delete"}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="text-xs px-3 py-1.5 border border-border rounded hover:bg-background-secondary"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-xs px-3 py-1.5 text-red-500 border border-red-500 rounded hover:bg-red-500 hover:text-white"
                >
                  Delete
                </button>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2">
          {isNew && (
            <button
              onClick={onCancel}
              className="text-xs px-3 py-1.5 border border-border rounded hover:bg-background-secondary"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="text-xs px-4 py-1.5 bg-foreground text-background rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : isNew ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
