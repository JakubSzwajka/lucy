import { call } from '@/lucy/ai';
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Memory } from '../entities/memory.entity';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class MemoriesService {
  constructor(
    @InjectRepository(Memory)
    private readonly memoryRepository: Repository<Memory>,
  ) {}

  async extractMemories(conversation: BaseMessage[], user: User) {
    const memories = await this.memoryRepository.find({
      where: {
        user,
      },
    });

    const prompt = `
        You are an assistant that analyzes the conversation between the user and the AI agent. 
        You are tasked to analyze the conversation and extract important facts, information, and memories.
        Example things to look for:
        - User's data (e.g., names, ages, preferences)
        - User's preferences (e.g., likes, dislikes)
        - Way of speaking (e.g., formal, casual)
        - Facts and information (e.g., user has two cats)
        - Plans and schedules (e.g., upcoming events)
        - User's goals (e.g., wants to learn something)
        - User's habits (e.g., daily routines)
        - Patterns (e.g., frequently mentioned topics)

        RULES:
        - Always respond with a valid JSON format
        - Respond with an empty object if no memories are found
        - Respond with an object with the key as 'memories' and the value as an array of memories
        - Avoid extracting temporary or context-specific questions unless they indicate a pattern or a recurring theme
        - Focus on extracting distinct, standalone facts and avoid combining multiple facts into one memory
        - Avoid repeating the same memory if it has already been extracted

        EXAMPLES: 
        Conversation 1
        User: I love hiking on weekends. It helps me relax after a busy week.
        Agent: {“memories”: [“User loves hiking”, “User hikes on weekends”]}

        Conversation 2
        User: My birthday is on July 15th. I usually celebrate with my family.
        Agent: {“memories”: [“User’s birthday is on July 15th”, “User celebrates birthday with family”]}

        Conversation 3
        User: Can you remind me to call my dentist tomorrow at 10 AM?
        Agent: {“memories”: [“User needs to call dentist tomorrow at 10 AM”]}

        Conversation 4
        User: I prefer tea over coffee. It’s just more soothing to me.
        Agent: {“memories”: [“User prefers tea over coffee”]}

        Conversation 5
        User: I need to finish my project by Friday. It’s really stressing me out.
        Agent: {“memories”: [“User needs to finish project by Friday”]}
        
        Conversation 6
        User: How’s the weather today?
        Agent: {}

        Conversation 7
        User: Can you tell me a joke?
        Agent: {}

        Conversation 8 (look that the agent is not duplicating the memory he already has)
        Memories: User loves hiking, User hikes on weekends, User’s birthday is on July 15th. 
        User: I’m planning to visit on July 15th (my birthday). We want to go hiking together cuz they love it too.
        Agent: {“memories”: [“User’s parents love hiking”]}


        MEMORIES:
        ${memories.map((memory) => memory.text).join('\n')}
    `;

    const conversationText = conversation.reduce((acc, message) => {
      if (message instanceof SystemMessage) return acc;
      if (message instanceof HumanMessage)
        return acc + `User: ${message.content}` + '\n';
      if (message instanceof AIMessage)
        return acc + `AI: ${message.content}` + '\n';

      return acc;
    }, '');

    const modelResponse = await call(
      [new SystemMessage(prompt), new HumanMessage(conversationText)],
      {
        jsonResponse: true,
      },
    );

    const { memories: newMemories } = JSON.parse(
      modelResponse.content as unknown as string,
    );
    console.log('New memories:', newMemories);

    if (!newMemories || newMemories.length === 0) return;

    await this.memoryRepository.save(
      newMemories.map((memory) => {
        return {
          user,
          text: memory,
        };
      }),
    );
  }
}
