// ---------------------------------------------------------------------------
// Anamnesis — Hook registration
// ---------------------------------------------------------------------------

import { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { assembleContext } from "./context.js";
import { runReflection } from "./reflection.js";

export function registerHooks(pi: ExtensionAPI) {
  pi.on("before_agent_start", assembleContext);
  pi.on("session_before_compact", runReflection);
}
