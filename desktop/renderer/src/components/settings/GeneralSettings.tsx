"use client";

import { useState, useEffect } from "react";
import type { UserSettings, SettingsUpdate } from "@/types";

interface GeneralSettingsProps {
  settings: UserSettings;
  onUpdateSettings: (updates: SettingsUpdate) => Promise<void>;
}

export function GeneralSettings({
  settings,
  onUpdateSettings,
}: GeneralSettingsProps) {
  const [contextWindowSize, setContextWindowSize] = useState(String(settings.contextWindowSize ?? 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setContextWindowSize(String(settings.contextWindowSize ?? 10));
  }, [settings.contextWindowSize]);

  const isDirty = contextWindowSize !== String(settings.contextWindowSize ?? 10);

  const handleSave = async () => {
    setSaving(true);
    try {
      const windowSize = parseInt(contextWindowSize, 10);
      await onUpdateSettings({
        contextWindowSize: isNaN(windowSize) ? 10 : Math.max(1, Math.min(100, windowSize)),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Context Window Size */}
      <div>
        <label className="label-dark block mb-2">Context Window Size</label>
        <input
          type="number"
          min={1}
          max={100}
          value={contextWindowSize}
          onChange={(e) => setContextWindowSize(e.target.value)}
          className="w-24 bg-background-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-muted-darker"
        />
        <p className="text-xs text-muted-dark mt-1">
          Number of recent user messages (and all responses between them) sent to the AI. Older messages stay in the database but are not included in the context.
        </p>
      </div>

      {/* Save Button */}
      {isDirty && (
        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-foreground text-background rounded text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}
