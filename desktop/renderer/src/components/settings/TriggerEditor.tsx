"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { useTriggerRuns } from "@/hooks/useTriggers";
import type {
  Trigger,
  TriggerCreate,
  TriggerUpdate,
  TriggerType,
  AgentConfigWithTools,
} from "@/types";

interface TriggerEditorProps {
  trigger: Trigger | null;
  agentConfigs: AgentConfigWithTools[];
  isNew: boolean;
  onSave: (data: TriggerCreate | TriggerUpdate) => Promise<void>;
  onDelete: () => Promise<void>;
  onCancel: () => void;
}

export function TriggerEditor({
  trigger,
  agentConfigs,
  isNew,
  onSave,
  onDelete,
  onCancel,
}: TriggerEditorProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState<TriggerType>("webhook");
  const [cronExpression, setCronExpression] = useState("");
  const [timezone, setTimezone] = useState("");
  const [agentConfigId, setAgentConfigId] = useState("");
  const [inputTemplate, setInputTemplate] = useState("");
  const [maxTurns, setMaxTurns] = useState(25);
  const [maxRunsPerHour, setMaxRunsPerHour] = useState(10);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const { runs, refetch: refetchRuns } = useTriggerRuns(trigger?.id ?? null);

  useEffect(() => {
    if (trigger) {
      setName(trigger.name);
      setDescription(trigger.description ?? "");
      setTriggerType(trigger.triggerType);
      setCronExpression(trigger.cronExpression ?? "");
      setTimezone(trigger.timezone ?? "");
      setAgentConfigId(trigger.agentConfigId);
      setInputTemplate(trigger.inputTemplate);
      setMaxTurns(trigger.maxTurns);
      setMaxRunsPerHour(trigger.maxRunsPerHour);
      setCooldownSeconds(trigger.cooldownSeconds);
      setEnabled(trigger.enabled);
    } else {
      setName("");
      setDescription("");
      setTriggerType("webhook");
      setCronExpression("");
      setTimezone("");
      setAgentConfigId(agentConfigs[0]?.id ?? "");
      setInputTemplate("");
      setMaxTurns(25);
      setMaxRunsPerHour(10);
      setCooldownSeconds(0);
      setEnabled(true);
    }
    setShowDeleteConfirm(false);
    setTestResult(null);
  }, [trigger, agentConfigs]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || !agentConfigId) return;

    setIsSaving(true);
    try {
      if (isNew) {
        await onSave({
          name: trimmedName,
          description: description.trim() || undefined,
          agentConfigId,
          triggerType,
          cronExpression: triggerType === "cron" ? cronExpression.trim() || undefined : undefined,
          timezone: triggerType === "cron" ? timezone.trim() || undefined : undefined,
          inputTemplate: inputTemplate.trim(),
          enabled,
          maxTurns,
          maxRunsPerHour,
          cooldownSeconds,
        } as TriggerCreate);
      } else {
        await onSave({
          name: trimmedName,
          description: description.trim() || null,
          agentConfigId,
          cronExpression: triggerType === "cron" ? cronExpression.trim() || null : null,
          timezone: triggerType === "cron" ? timezone.trim() || null : null,
          inputTemplate: inputTemplate.trim(),
          enabled,
          maxTurns,
          maxRunsPerHour,
          cooldownSeconds,
        } as TriggerUpdate);
      }
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

  const handleTest = async () => {
    if (!trigger) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await api.testTrigger(trigger.id);
      setTestResult(`Run started (session: ${result.sessionId})`);
      refetchRuns();
    } catch (err) {
      setTestResult(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsTesting(false);
    }
  };

  if (!trigger && !isNew) {
    return (
      <div className="flex items-center justify-center h-full text-muted-dark">
        <p className="text-sm">Select a trigger or create a new one</p>
      </div>
    );
  }

  const inputClass =
    "w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-muted-darker";
  const selectClass =
    "w-full bg-background-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-muted-darker appearance-none";

  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto">
      {/* Name */}
      <div className="mb-4">
        <label className="label-dark block mb-2">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Daily Summary"
          className={inputClass}
        />
      </div>

      {/* Description */}
      <div className="mb-4">
        <label className="label-dark block mb-2">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this trigger does..."
          rows={2}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Trigger Type + Agent Config */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="label-dark block mb-2">Trigger Type</label>
          <select
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value as TriggerType)}
            className={selectClass}
            disabled={!isNew}
          >
            <option value="webhook">Webhook</option>
            <option value="cron">Cron</option>
          </select>
        </div>
        <div>
          <label className="label-dark block mb-2">Agent Config</label>
          <select
            value={agentConfigId}
            onChange={(e) => setAgentConfigId(e.target.value)}
            className={selectClass}
          >
            <option value="">Select...</option>
            {agentConfigs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ""}{c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cron fields */}
      {triggerType === "cron" && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="label-dark block mb-2">Cron Expression</label>
            <input
              type="text"
              value={cronExpression}
              onChange={(e) => setCronExpression(e.target.value)}
              placeholder="*/5 * * * *"
              className={`${inputClass} font-mono`}
            />
            <p className="text-xs text-muted-dark mt-1">Standard 5-field cron syntax</p>
          </div>
          <div>
            <label className="label-dark block mb-2">Timezone</label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="UTC"
              className={inputClass}
            />
          </div>
        </div>
      )}

      {/* Input Template */}
      <div className="mb-4">
        <label className="label-dark block mb-2">Input Template</label>
        <textarea
          value={inputTemplate}
          onChange={(e) => setInputTemplate(e.target.value)}
          placeholder="The message sent to the agent. Use {{payload.key}} for webhook data."
          rows={3}
          className={`${inputClass} resize-none font-mono text-xs`}
        />
        <p className="text-xs text-muted-dark mt-1">
          {"Use {{payload.key}} to interpolate webhook payload fields"}
        </p>
      </div>

      {/* Limits */}
      <div className="grid grid-cols-3 gap-3 mb-4">
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
        <div>
          <label className="label-dark block mb-2">Max Runs/Hour</label>
          <input
            type="number"
            value={maxRunsPerHour}
            onChange={(e) => setMaxRunsPerHour(Number(e.target.value) || 10)}
            min={1}
            className={inputClass}
          />
        </div>
        <div>
          <label className="label-dark block mb-2">Cooldown (s)</label>
          <input
            type="number"
            value={cooldownSeconds}
            onChange={(e) => setCooldownSeconds(Number(e.target.value) || 0)}
            min={0}
            className={inputClass}
          />
        </div>
      </div>

      {/* Enabled toggle */}
      <div className="mb-4">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-border bg-background-secondary"
          />
          Enabled
        </label>
      </div>

      {/* Test button (only for existing triggers) */}
      {!isNew && trigger && (
        <div className="mb-4 border border-border rounded p-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleTest}
              disabled={isTesting}
              className="text-xs px-3 py-1.5 border border-border rounded hover:bg-background-secondary disabled:opacity-50"
            >
              {isTesting ? "Running..." : "Test Trigger"}
            </button>
            {testResult && (
              <span className="text-xs text-muted-dark font-mono">{testResult}</span>
            )}
          </div>
        </div>
      )}

      {/* Run History */}
      {!isNew && trigger && runs.length > 0 && (
        <div className="mb-4 border border-border rounded p-3">
          <span className="label-dark block mb-2">Recent Runs</span>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {runs.map((run) => (
              <div
                key={run.id}
                className="flex items-center gap-2 text-xs py-1 border-b border-border last:border-0"
              >
                <span
                  className={`font-mono px-1.5 py-0.5 rounded ${
                    run.status === "completed"
                      ? "text-green-500 bg-green-500/10"
                      : run.status === "failed"
                      ? "text-red-500 bg-red-500/10"
                      : run.status === "running"
                      ? "text-blue-500 bg-blue-500/10"
                      : "text-muted-dark bg-background-secondary"
                  }`}
                >
                  {run.status}
                </span>
                {(run.status === "running" || run.status === "pending") && trigger && (
                  <button
                    onClick={async () => {
                      try {
                        await api.cancelTriggerRun(trigger.id, run.id);
                        refetchRuns();
                      } catch { /* ignore */ }
                    }}
                    className="px-1.5 py-0.5 text-red-500 border border-red-500 rounded hover:bg-red-500 hover:text-white font-mono"
                  >
                    stop
                  </button>
                )}
                <span className="text-muted-dark font-mono">
                  {run.startedAt
                    ? new Date(run.startedAt).toLocaleString()
                    : "—"}
                </span>
                {run.error && (
                  <span className="text-red-500 truncate flex-1">{run.error}</span>
                )}
                {run.result && !run.error && (
                  <span className="text-muted-dark truncate flex-1">{run.result}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border flex-shrink-0 mt-auto">
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
            disabled={isSaving || !name.trim() || !agentConfigId}
            className="text-xs px-4 py-1.5 bg-foreground text-background rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : isNew ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
