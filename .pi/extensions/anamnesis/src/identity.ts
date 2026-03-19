import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { IDENTITY_PATH } from "./paths.js";

interface IdentityItem {
  text: string;
  observations?: string;
}

interface Identity {
  capabilities: IdentityItem[];
  communicationPatterns: IdentityItem[];
  knownBiases: IdentityItem[];
  relationshipStates: IdentityItem[];
  uncertainties: string[];
}

const SECTION_MAP: Record<string, keyof Omit<Identity, "uncertainties">> = {
  "Core Capabilities": "capabilities",
  "Communication Patterns": "communicationPatterns",
  "Known Biases": "knownBiases",
  "Relationship States": "relationshipStates",
};

function parseItem(line: string): IdentityItem {
  const trimmed = line.replace(/^-\s*/, "").trim();
  const match = trimmed.match(/^(.+?)\s*\(observed:\s*(.+?)\)$/);
  if (match) {
    return { text: match[1].trim(), observations: match[2].trim() };
  }
  // Try alternate pattern: "(see ...)" isn't an observation
  return { text: trimmed };
}

function parseUncertainty(line: string): string {
  const trimmed = line.replace(/^-\s*/, "").trim();
  // Strip trailing parenthetical if present
  return trimmed.replace(/\s*\(.*\)$/, "").trim();
}

function parseSections(content: string): Identity {
  const identity: Identity = {
    capabilities: [],
    communicationPatterns: [],
    knownBiases: [],
    relationshipStates: [],
    uncertainties: [],
  };

  let currentSection: string | null = null;

  for (const line of content.split("\n")) {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      currentSection = headingMatch[1].trim();
      continue;
    }

    if (!line.startsWith("- ")) continue;
    if (!currentSection) continue;

    if (currentSection === "What I'm Uncertain About") {
      identity.uncertainties.push(parseUncertainty(line));
    } else if (currentSection in SECTION_MAP) {
      const key = SECTION_MAP[currentSection];
      identity[key].push(parseItem(line));
    }
  }

  return identity;
}

export async function loadIdentity(): Promise<Identity | null> {
  if (!existsSync(IDENTITY_PATH)) {
    return null;
  }

  const content = await readFile(IDENTITY_PATH, "utf-8");
  return parseSections(content);
}

export function renderIdentityContext(identity: Identity): string {
  const lines: string[] = ["[identity]"];

  if (identity.capabilities.length > 0) {
    lines.push("Strengths: " + identity.capabilities.map((c) => c.text).join("; "));
  }

  if (identity.communicationPatterns.length > 0) {
    lines.push("Communication: " + identity.communicationPatterns.map((p) => p.text).join("; "));
  }

  if (identity.knownBiases.length > 0) {
    lines.push("Watch for: " + identity.knownBiases.map((b) => b.text).join("; "));
  }

  if (identity.relationshipStates.length > 0) {
    lines.push("Relationships: " + identity.relationshipStates.map((r) => r.text).join("; "));
  }

  if (identity.uncertainties.length > 0) {
    lines.push("Open questions: " + identity.uncertainties.join("; "));
  }

  return lines.join("\n");
}
