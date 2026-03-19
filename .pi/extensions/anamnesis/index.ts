// ---------------------------------------------------------------------------
// Anamnesis Extension
// ---------------------------------------------------------------------------
// The experience system for Lucy. Delegates to:
// - hooks/: before_agent_start (context assembly) + session_before_compact (reflection)
// - tools/: knowledge_search + knowledge_create (LLM-callable)
// ---------------------------------------------------------------------------

import { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerHooks } from "./hooks/index.js";
import { registerTools } from "./tools/index.js";

export default function (pi: ExtensionAPI) {
  registerTools(pi);
  registerHooks(pi);
}
