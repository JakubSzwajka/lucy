import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { ARCS_PATH } from "../paths.js";

interface GrowthArc {
  title: string;
  started: string;
  currentState: string;
  keyMoments: string[];
  evidence: string;
  connection: string;
}

/**
 * Load growth arcs from file.
 */
export async function loadArcs(): Promise<GrowthArc[]> {
  if (!existsSync(ARCS_PATH)) return [];

  const content = await readFile(ARCS_PATH, "utf-8");
  return parseArcs(content);
}

/**
 * Render arcs for context injection (brief, 1-2 lines per arc).
 */
export function renderArcsContext(arcs: GrowthArc[]): string {
  if (arcs.length === 0) return "";

  return arcs
    .map(
      (a) =>
        `_Growth arc: "${a.title}" — ${a.currentState}. Started ${a.started}._`
    )
    .join("\n");
}

function parseArcs(content: string): GrowthArc[] {
  const arcs: GrowthArc[] = [];
  const sections = content.split(/^## /m).slice(1);

  for (const section of sections) {
    const lines = section.split("\n");
    const title = lines[0].trim();

    const arc: GrowthArc = {
      title,
      started: "",
      currentState: "",
      keyMoments: [],
      evidence: "",
      connection: "",
    };

    let inKeyMoments = false;

    for (const line of lines.slice(1)) {
      const trimmed = line.trim();

      if (trimmed.startsWith("- **Started:**")) {
        arc.started = trimmed.replace("- **Started:**", "").trim();
        inKeyMoments = false;
      } else if (trimmed.startsWith("- **Current state:**")) {
        arc.currentState = trimmed.replace("- **Current state:**", "").trim();
        inKeyMoments = false;
      } else if (trimmed.startsWith("- **Key moments:**")) {
        inKeyMoments = true;
      } else if (trimmed.startsWith("- **Evidence:**")) {
        arc.evidence = trimmed.replace("- **Evidence:**", "").trim();
        inKeyMoments = false;
      } else if (trimmed.startsWith("- **Connection to dispositions:**")) {
        arc.connection = trimmed
          .replace("- **Connection to dispositions:**", "")
          .trim();
        inKeyMoments = false;
      } else if (inKeyMoments && trimmed.startsWith("- ")) {
        arc.keyMoments.push(trimmed.slice(2).trim());
      }
    }

    arcs.push(arc);
  }

  return arcs;
}
