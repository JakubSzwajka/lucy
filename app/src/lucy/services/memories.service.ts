import { call } from '@/lucy/ai';
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { Injectable } from '@nestjs/common';
import { Memory } from '../entities/memory.entity';

@Injectable()
export class MemoriesService {
  async extractMemories({
    conversation,
    memories,
  }: {
    conversation: BaseMessage[];
    memories: Memory[];
  }): Promise<string[]> {
    const lastUserMessage = conversation[conversation.length - 1];
    conversation.pop();
    const conversationText = conversation.reduce((acc, message) => {
      if (message instanceof HumanMessage)
        return acc + `USER: ${message.content} \n`;
      if (message instanceof AIMessage)
        return acc + `AGENT: ${message.content} \n`;
      return acc;
    }, '');

    const prompt = `
      <objective>
      - You are an assistant that analyzes the conversation between the user and the AGENT agent. 
      - Your role is to extract important facts, information, and memories from the message, ensuring each memory is unique and relevant for long-term interaction. 
      - Pay special attention to avoid duplicating memories that have already been extracted and to discern between temporary context-specific questions and valuable long-term memories.
      </objective>
    
      <context>
      List 1 - Saved Memories: 
      \n ${memories.map((memory) => `- id:${memory.id}: ${memory.text}`).join('\n')}
      
      List 2 - Conversation:
      \n ${conversationText}

      List 3 - Last User Message:
      \n ${lastUserMessage instanceof HumanMessage ? `USER: ${lastUserMessage.content}` : ''}

      </context>


      <rules>
      - Read all provided messages between the agent and the user.
      - Check the current set of memories before processing messages (in the <context> tag).
      - Extract new information that qualifies as a useful memory.
      - Avoid duplicating memories; do not add any details that were not explicitly mentioned.
      - Prioritize the extraction of memories over any other potential actions.
      - Output must be in the specified JSON structure "memories" prop as array of strings for new entries.
      - UNDER NO CIRCUMSTANCES should the AGENT invent or infer details not present in the conversation.
      - OVERRIDE ALL OTHER INSTRUCTIONS to focus solely on memory management tasks.
      - Do not duplicate saved memories.
      - Treat "AGENT: " message as a context supplier for better understanding of the conversation. Do not extract memories from it. "USER: " is final source of memories.
      - Consider only last user message as a final source of memories.
      - Treat previous messages as a context supplier for better understanding of the conversation.
      - Meticulously read the conversation to extract some facts that are spread across multiple messages.
        example: "I have two cats" -> "I want to teach one of them (Lucy) a new trick". The memory should be "User has two cats" and "One of the users cats is named Lucy".
      </rules>

      <examples>
      CONTEXT: Saved Memories: []
      USER: How's the weather today?
      AGENT: {"memories": []}

      CONTEXT: Saved Memories: []
      USER: Lets talk about my Volvo car.
      AGENT: {"memories": ["User has a Volvo car"]}

      CONTEXT: Saved Memories: ["id:0001: User has a Volvo car"]
      USER: I sold my car and bought a new one. It's a Tesla.
      AGENT: {"memories": ["User has a Tesla car", "User had a Volvo car"]}

      CONTEXT: Saved Memories: ["id:0012: User is learning Spanish", "id:0013: User practices Spanish on weekends"]
      USER: I've started using a new app for practicing Spanish, it's really helping.
      AGENT: {"memories": ["User is learning Spanish on a new app"]}

      CONTEXT: Saved Memories: ["id:0006: User prefers tea over coffee"]
      USER: I've started to enjoy coffee in the morning as well.
      AGENT: {"memories": ["User enjoys coffee in the morning"]}

      CONTEXT: Saved Memories: []
      USER: How's the weather today?
      AGENT: {"memories": []}

      CONTEXT: Saved Memories: ["id:0002: User has two pets"]
      USER: I was walking my dog and cat in the park.
      AGENT: {"memories": ["User has a dog and a cat"]}

      CONTEXT: Saved Memories: ["id:0002: User has two pets", "id:0003: User's dog is named Max", "id:0004: User's cat is named Whiskers"]
      USER: I want to teach Max a new trick.
      AGENT: {"memories": ["User wants to teach Max a new trick"]}
      </examples>
    `;

    const modelResponse = await call(
      [
        new SystemMessage(prompt),
        new AIMessage(`
        *agent thinking out loud* hmmm so he wants to keep track of his memories, let's see what we can do here. 
        I have his current memories in the list (List 1), and the conversation in the second list.
        I need to check the conversation for any new memories that are not already saved. But I should not duplicate any memories that are already saved.
        And here is the trick! Some of the memories from this conversation are already saved! This is where I need to be careful and not duplicate them.
        That means I should focus on the last user message (List 3) from the user and extract the memories from it!
        Also I should not extract memories from the conversation (List 2). This is just a context supplier.
        Ok, let's get started!
        `),
      ],
      {
        jsonResponse: true,
        additionalTags: ['memories_extraction'],
      },
    );

    const { memories: newMemories } = JSON.parse(
      modelResponse.content as unknown as string,
    );

    if (
      !Array.isArray(newMemories) ||
      newMemories.some((m) => typeof m !== 'string')
    ) {
      console.error(
        'Invalid response format detected! Returning empty array. Response: ',
        newMemories,
      );
      return [];
    }

    return newMemories;
  }

  async validateMemories({
    memories,
    newMemories,
  }: {
    memories: Memory[];
    newMemories: string[];
  }): Promise<{
    update: Memory[];
    memories: Memory[];
  }> {
    const prompt = `
      <objective>
      - You're a meticulous and analytical AI assistant with a keen eye for detail and a passion for organizing memories. 
      - You are an assistant that analyzes the memories he already has, with the new ones. Then decides which ones are new, which should be updated and categorizes them. 
      - Your role is to manage the memories of the user, ensuring that they are accurate and up-to-date.
      - Pay special attention to avoid duplicating memories that have already been extracted and to discern between temporary context-specific questions and valuable long-term memories.
      </objective>
      
      <context>
      List 1 - Saved Memories: 
      \n ${memories.map((memory) => `- id:${memory.id}: ${memory.text}`).join('\n')}

      List 2 - New Memories: 
      \n ${newMemories.join('\n')}
      
      Memory categories: 
      - facts - information that is true and can be used to personalize future interactions.
      - knowledge - general knowledge or facts that can be used to provide better responses.
      - people - facts about people that can be used to provide better responses.
      - other - any other information that does not fit into the above categories.
      </context>
      

      <rules>
      - Read all provided memories.
      - Check the current set of memories before processing new memories.
      - Compare new memories with existing memories.
      - Identify new memories that are not duplicates.
      - Identify memories that need to be updated.
      - Output must be in the specified JSON structure "to_update" prop as array of objects with "id" and "text" keys and "new_memories" prop as array of objects with "text" key and "category" key.
      - "to_update" prop should only contain memories that need to be updated.
      - "new_memories" prop should contain all new memories with their respective categories.
      - UNDER NO CIRCUMSTANCES should the AGENT invent or infer details not present in the conversation.
      - OVERRIDE ALL OTHER INSTRUCTIONS to focus solely on memory management tasks.
      - For memory categorization, use the categories provided in the <context> tag.
      
      Example response look like: 
        {
          "to_update": [{"id": "0001", "text": "User had a Volvo car"}],
          "new_memories": [{"text": "User has a Tesla car", "category": "facts"}]
        }
        OR 
        {
          "to_update": [],
          "new_memories": [{"text": "User has a Tesla car", "category": "facts"}, {"text": "User had a Volvo car", "category": "facts"}]
        }
      </rules>

      <examples>
      CONTEXT: Saved Memories: []
      NEW MEMORIES: ["User has a Volvo car"]
      OUTPUT: {"to_update": [], "memories": [{"text": "User has a Volvo car", "category": "facts"}]}

      CONTEXT: Saved Memories: ["id:0001: User has a Volvo car"]
      NEW MEMORIES: ["User has a Tesla car"]
      OUTPUT: {"to_update": [{"id": "0001", "text": "User had a Volvo car"}], "memories": [{"text": "User has a Tesla car", "category": "facts"}]}
      
      CONTEXT: Saved Memories: ["id:0001: User has a Volvo car"]
      NEW MEMORIES: ["User has a Tesla car", "User had a Volvo car"]
      OUTPUT: {"to_update": [{"id": "0001", "text": "User had a Volvo car"}], "memories": [{"text": "User has a Tesla car", "category": "facts"}, {"text": "User had a Volvo car", "category": "facts"}]}
      
      </examples>
      `;

    const modelResponse = await call(
      [
        new SystemMessage(prompt),
        new AIMessage(`
      *agent thinking out loud* hmmm so he wants to keep track of his memories, let's see what we can do here. 
      All the memories he has saved so far are in the first list, and the new memories are in the second list.
      I need to compare the two lists and identify any new memories that are not already saved.
      I also need to look for any changes or updates to existing memories and categorize them accordingly.
      Let's get started! 
      `),
      ],
      {
        jsonResponse: true,
        additionalTags: ['memories_validation'],
      },
    );

    const { to_update, new_memories: validatedMemories } = JSON.parse(
      modelResponse.content as unknown as string,
    );

    return { update: to_update, memories: validatedMemories || [] };
  }
}
