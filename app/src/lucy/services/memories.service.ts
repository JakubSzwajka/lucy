import { call } from '@/lucy/ai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Memory } from '../entities/memory.entity';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Message } from '../entities/message.entity';

@Injectable()
export class MemoriesService {
  constructor(
    @InjectRepository(Memory)
    private readonly memoryRepository: Repository<Memory>,
  ) {}

  async extractMemories(message: Message, user: User) {
    const memories = await this.memoryRepository.find({
      where: {
        user,
      },
    });

    const prompt = `
You are an assistant that analyzes the conversation between the user and the AI agent. 
Your role is to extract important facts, information, and memories from the message, ensuring each memory is unique and relevant for long-term interaction. 
Pay special attention to avoid duplicating memories that have already been extracted and to discern between temporary context-specific questions and valuable long-term memories.

Example things to look for:
- User's personal data (e.g., names, ages, preferences)
- User's preferences (e.g., likes, dislikes, habits)
- Significant plans, goals, or schedules (e.g., learning goals, daily routines)
- Patterns or frequently mentioned topics that reveal deeper insights into the user's life and preferences

RULES:
- Always respond with a valid JSON format.
- Respond with an empty object if no new, non-duplicate memories are found.
- Use the key 'memories' for the array of newly extracted memories, ensuring they are distinct and not previously noted.
- Use the key 'update' for the array of objects that need to be updated. Object should have the following keys: 'id' and 'text'.
- Exclude temporary or context-specific details unless they reveal a pattern or significant preference.
- Check against the provided list of existing memories to avoid duplication and to identify opportunities for updates.
- Focus on extracting standalone facts; do not combine multiple facts into one memory unless they form a cohesive and significant insight.

EXAMPLES: 
Conversation 1
Given Memories: ["id:0001: User loves hiking", "id:0002: User hikes on weekends"]
User: I just remembered, I also enjoy hiking during holidays.
Updated Memories: {"update": [{"id": "0001", "text": "User loves hiking on weekends and holidays"}], "memories": []}
Conversation 2
Given Memories: ["id:0003: User's birthday is on July 15th", "id:0004: User celebrates birthday with family"]
User: This year, I'm thinking of also inviting friends to my birthday celebration.
Updated Memories: {"update": [{"id": "0004", "text": "User celebrates birthday with family and friends"}], "memories": []}
Conversation 3
Given Memories: ["id:0005: User needs to call dentist tomorrow at 10 AM"]
User: Actually, the appointment with the dentist is now at 11 AM.
Updated Memories: {"update": [{"id": "0005", "text": "User needs to call dentist tomorrow at 11 AM"}], "memories": []}
Conversation 4
Given Memories: ["id:0006: User prefers tea over coffee"]
User: I've started to enjoy coffee in the morning as well.
Updated Memories: {"update": [], "memories": ["User enjoys coffee in the morning"]}
Conversation 5
Given Memories: ["id:0007: User needs to finish project by Friday"]
User: The deadline for the project got moved to next Monday.
Updated Memories: {"update": [{"id": "0007", "text": "User needs to finish project by next Monday"}], "memories": []}
Conversation 6
Given Memories: []
User: How's the weather today?
Updated Memories: {"update": [], "memories": []}
Conversation 7
Given Memories: []
User: Can you tell me a joke?
Updated Memories: {"update": [], "memories": []}
Conversation 8
Given Memories: ["id:0008: User loves hiking", "id:0009: User hikes on weekends", "id:0010: User's birthday is on July 15th"]
User: I'm planning a hiking trip for my birthday on July 15th. It's my favorite way to celebrate.
Updated Memories: {"update": [{"id": "0010", "text": "User's birthday is on July 15th and loves celebrating it with a hiking trip"}], "memories": []}
Conversation 9
Given Memories: ["id:0011: User has two cats named Lucy and Niunia"]
User: Just so you know, Lucy, one of my cats, is a black cat.
Updated Memories: {"update": [{"id": "0011", "text": "User has two cats named Lucy and Niunia; Lucy is a black cat"}], "memories": []}
Conversation 10
Given Memories: ["id:0012: User is learning Spanish", "id:0013: User practices Spanish on weekends"]
User: I've started using a new app for practicing Spanish, it's really helping.
Updated Memories: {"update": [{"id": "0013", "text": "User practices Spanish on weekends using a new app"}], "memories": []}
Conversation 11
Given Memories: []
User: Lets talk about my volvo car.
Updated Memories: {"update": [], "memories": ["User has a Volvo car"]}

Given the following existing memories: \n ${memories.map((memory) => `- id:${memory.id}: ${memory.text}`).join('\n')}

Analyze the conversation and update the memories accordingly, ensuring they are comprehensive and reflect the latest information provided by the user.
    `;

    const modelResponse = await call(
      [new SystemMessage(prompt), new HumanMessage(message.text)],
      {
        jsonResponse: true,
      },
    );

    console.log('#######', modelResponse.content);
    const { memories: newMemories, update } = JSON.parse(
      modelResponse.content as unknown as string,
    );
    console.log('New memories:', newMemories);
    console.log('Update:', update);

    if (update && update.length > 0) {
      for (const { id, text } of update) {
        const memory = await this.memoryRepository.findOne({
          where: { id },
          relations: ['messages'],
        });
        if (!memory) {
          console.error(`Memory with id ${id} not found`);
          continue;
        }
        await this.memoryRepository.update(id, {
          text,
          messages: [...memory.messages, message],
        });
      }
    }

    if (!newMemories || newMemories.length === 0) return;

    for (const memory of newMemories) {
      await this.memoryRepository.save({
        text: memory,
        user,
        messages: [message],
      });
    }
  }
}
