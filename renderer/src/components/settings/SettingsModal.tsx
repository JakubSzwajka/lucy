"use client";

import { useState, useEffect } from "react";
import { SettingsTabs, type SettingsTab } from "./SettingsTabs";
import { GeneralSettings } from "./GeneralSettings";
import { ModelsSettings } from "./ModelsSettings";
import { SystemPromptsSettings } from "./SystemPromptsSettings";
import { useSettings } from "@/hooks/useSettings";
import { useSystemPrompts } from "@/hooks/useSystemPrompts";
import type { AvailableProviders } from "@/types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableProviders?: AvailableProviders;
}

export function SettingsModal({
  isOpen,
  onClose,
  availableProviders,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const { settings, isLoading: settingsLoading, updateSettings } = useSettings();
  const {
    prompts,
    isLoading: promptsLoading,
    createPrompt,
    updatePrompt,
    deletePrompt,
  } = useSystemPrompts();

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isLoading = settingsLoading || promptsLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-background border border-border rounded-lg shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="label">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-background-secondary rounded transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <span className="text-muted-dark">Loading...</span>
            </div>
          ) : settings ? (
            <>
              {activeTab === "general" && (
                <GeneralSettings
                  settings={settings}
                  systemPrompts={prompts}
                  availableProviders={availableProviders}
                  onUpdateSettings={updateSettings}
                  onNavigateToPrompts={() => setActiveTab("prompts")}
                />
              )}
              {activeTab === "models" && (
                <ModelsSettings
                  settings={settings}
                  availableProviders={availableProviders}
                  onUpdateSettings={updateSettings}
                />
              )}
              {activeTab === "prompts" && (
                <SystemPromptsSettings
                  prompts={prompts}
                  defaultPromptId={settings.defaultSystemPromptId}
                  onCreatePrompt={createPrompt}
                  onUpdatePrompt={updatePrompt}
                  onDeletePrompt={deletePrompt}
                  onUpdateSettings={updateSettings}
                />
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-40">
              <span className="text-muted-dark">Failed to load settings</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
