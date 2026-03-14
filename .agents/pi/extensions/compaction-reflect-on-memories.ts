// ---------------------------------------------------------------------------
// Compaction Reflect on Memories Extension
// ---------------------------------------------------------------------------
// Triggers memory reflection when the agent ends.
// ---------------------------------------------------------------------------

import { ExtensionAPI, serializeConversation, convertToLlm } from "@mariozechner/pi-coding-agent";
import { ContinuitySkill } from "../../skills/continuity/src/index.js";
const skill = new ContinuitySkill();

async function triggerReflection(pi: ExtensionAPI) {

    pi.on("session_before_compact", async (event, ctx) => {
        const { preparation } = event;
        
        console.log("[compaction-reflect-on-memories] session_before_compact");
        // Convert AgentMessage[] to Message[], then serialize to text
        const conversationText = serializeConversation(
          convertToLlm(preparation.messagesToSummarize)
        );
        // Returns:
        // [User]: message text
        // [Assistant thinking]: thinking content
        // [Assistant]: response text
        // [Assistant tool calls]: read(path="..."); bash(command="...")
        // [Tool result]: output text
      
        // Trigger continuity skill to reflect on memories
        await skill.reflect({
          session: "custom",
          summary: conversationText 
        });

        return {
          compaction: {
            summary: conversationText ?? "Custom Summary to be implemented. As soon as you will hit one, notify Kuba. Since this point, you should start thinking based on your memories and available messages.",
            firstKeptEntryId: preparation.firstKeptEntryId,
            tokensBefore: preparation.tokensBefore,
          }
        };
      });
      }