// ---------------------------------------------------------------------------
// Anamnesis — Phase 1: Foresight
// ---------------------------------------------------------------------------
// Backward-looking: did any predictions from previous sessions come true
// in this conversation? Checks keyword overlap, confirms matches.
// ---------------------------------------------------------------------------

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { loadPredictions, savePredictions } from "./store.js";
import { DISPOSITION_PROFILE_PATH } from "./paths.js";

export async function checkForesight(conversationText: string): Promise<void> {
  const predictions = await loadPredictions();
  const pending = predictions.filter((p) => p.status === "pending");
  console.log(`[anamnesis] foresight: ${predictions.length} total predictions, ${pending.length} pending`);

  if (pending.length === 0) return;

  const conversationLower = conversationText.toLowerCase();
  let confirmed = 0;

  for (const pred of pending) {
    const keywords = pred.content
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4)
      .slice(0, 5);

    const matches = keywords.filter((kw) => conversationLower.includes(kw));
    const matchRatio = keywords.length > 0 ? matches.length / keywords.length : 0;

    if (matchRatio >= 0.4) {
      pred.status = "confirmed";
      pred.resolved_at = new Date().toISOString().split("T")[0];
      confirmed++;
    }
  }

  if (confirmed === 0) return;

  await savePredictions(predictions);
  console.log(`[anamnesis] foresight: ${confirmed} predictions confirmed`);

  // Append note to disposition profile
  try {
    if (existsSync(DISPOSITION_PROFILE_PATH)) {
      const profile = await readFile(DISPOSITION_PROFILE_PATH, "utf-8");
      const confirmedPreds = pending.filter((p) => p.status === "confirmed");
      const note = confirmedPreds
        .map((p) => `- "${p.content}" — confirmed ${p.resolved_at}`)
        .join("\n");
      const updated = profile.replace(
        "### Active Predictions",
        `### Active Predictions\n\n#### Recently Confirmed\n${note}\n`,
      );
      await writeFile(DISPOSITION_PROFILE_PATH, updated, "utf-8");
    }
  } catch {}
}
