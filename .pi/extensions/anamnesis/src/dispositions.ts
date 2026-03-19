import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { DISPOSITION_PROFILE_PATH as PROFILE_PATH } from "./paths.js";

export interface Tendency {
  name: string;
  strength: string;
  evidence: string;
  watchFor: string;
}

export interface MentalModel {
  name: string;
  content: string;
  lastVerified?: string;
}

export interface DispositionProfile {
  tendencies: Tendency[];
  mentalModels: MentalModel[];
  predictions: string[];
  lastUpdated: string;
}

/**
 * Parse the disposition profile markdown into a structured object.
 * Returns null if the file doesn't exist or is empty.
 */
export async function loadDispositionProfile(): Promise<DispositionProfile | null> {
  if (!existsSync(PROFILE_PATH)) return null;

  const raw = await readFile(PROFILE_PATH, "utf-8");
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const lastUpdatedMatch = trimmed.match(
    /## Last updated:\s*(.+?)(?:\n|$)/,
  );
  const lastUpdated = lastUpdatedMatch?.[1]?.trim() ?? "unknown";

  const tendencies = parseTendencies(trimmed);
  const mentalModels = parseMentalModels(trimmed);
  const predictions = parsePredictions(trimmed);

  return { tendencies, mentalModels, predictions, lastUpdated };
}

function parseTendencies(text: string): Tendency[] {
  const tendencies: Tendency[] = [];

  // Extract the Tendencies section
  const tendenciesMatch = text.match(
    /### Tendencies[^\n]*\n([\s\S]*?)(?=\n### |$)/,
  );
  if (!tendenciesMatch) return tendencies;

  const section = tendenciesMatch[1];

  // Split by h4 headers (#### Name)
  const blocks = section.split(/(?=^#### )/m).filter((b) => b.trim());

  for (const block of blocks) {
    const nameMatch = block.match(/^#### (.+)/);
    if (!nameMatch) continue;

    const name = nameMatch[1].trim();
    const strength =
      block.match(/\*\*Strength:\*\*\s*(.+)/)?.[1]?.trim() ?? "unknown";
    const evidence =
      block.match(/\*\*Evidence:\*\*\s*(.+)/)?.[1]?.trim() ?? "";
    const watchFor =
      block.match(/\*\*Watch for:\*\*\s*(.+)/)?.[1]?.trim() ?? "";

    tendencies.push({ name, strength, evidence, watchFor });
  }

  return tendencies;
}

function parseMentalModels(text: string): MentalModel[] {
  const models: MentalModel[] = [];

  const modelsMatch = text.match(
    /### Mental Models\n([\s\S]*?)(?=\n### |$)/,
  );
  if (!modelsMatch) return models;

  const section = modelsMatch[1];
  const blocks = section.split(/(?=^#### )/m).filter((b) => b.trim());

  for (const block of blocks) {
    const nameMatch = block.match(/^#### (.+)/);
    if (!nameMatch) continue;

    const name = nameMatch[1].trim();
    const lastVerifiedMatch = block.match(
      /- Last verified:\s*(.+)/,
    );
    const lastVerified = lastVerifiedMatch?.[1]?.trim();

    // Content is the bullet lines excluding "Last verified"
    const contentLines = block
      .split("\n")
      .slice(1)
      .filter((line) => line.startsWith("- ") && !line.includes("Last verified"))
      .map((line) => line.replace(/^- /, "").trim());

    models.push({
      name,
      content: contentLines.join("; "),
      lastVerified,
    });
  }

  return models;
}

function parsePredictions(text: string): string[] {
  const predictionsMatch = text.match(
    /### Active Predictions\n([\s\S]*?)(?=\n### |$)/,
  );
  if (!predictionsMatch) return [];

  const section = predictionsMatch[1].trim();

  // Filter out placeholder lines
  const lines = section
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- ") && !l.includes("none yet"));

  return lines.map((l) => l.replace(/^- /, "").trim());
}

/**
 * Render the disposition profile as a concise first-person narrative
 * suitable for system prompt injection (<500 tokens).
 */
export function renderDispositionContext(profile: DispositionProfile): string {
  const parts: string[] = [];

  if (profile.tendencies.length > 0) {
    const tendencyLines = profile.tendencies.map((t) => {
      let line = `I tend toward ${t.name.toLowerCase()} (${t.strength}).`;
      if (t.watchFor) line += ` Watch for: ${t.watchFor.charAt(0).toLowerCase() + t.watchFor.slice(1)}`;
      return line;
    });
    parts.push(tendencyLines.join(" "));
  }

  if (profile.mentalModels.length > 0) {
    const modelLines = profile.mentalModels.map(
      (m) => `${m.name}: ${m.content}`,
    );
    parts.push("Mental models: " + modelLines.join(". ") + ".");
  }

  if (profile.predictions.length > 0) {
    parts.push(
      "Active predictions: " + profile.predictions.join("; ") + ".",
    );
  }

  return parts.join("\n\n");
}
