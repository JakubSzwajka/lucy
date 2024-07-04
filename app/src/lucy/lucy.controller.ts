import { Controller, Get, Post, Body, Headers } from '@nestjs/common';
import { Message } from './entities/message.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Paginated } from 'src/infra/types';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { LucyService } from './lucy.service';
import { skills } from './lucy.tools';

const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tool: z.string(),
});

class SkillDto extends createZodDto(SkillSchema) {}

@Controller()
export class LucyController {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly lucy: LucyService,
  ) {}

  @Post('talk')
  async talk(
    @Body() body: { message: string },
    @Headers() headers,
  ): Promise<{
    message: string;
  }> {
    const source = headers['x-message-source'];
    const conversationId = headers['x-conversation-id'];
    const response = await this.lucy.talk(body.message, {
      messageSource: source,
      conversationId,
    });
    return {
      message: response,
    };
  }

  @Get('skills')
  async getSkills(): Promise<Paginated<SkillDto>> {
    return {
      items: skills.map((skill) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        tool: JSON.stringify(skill.tool),
      })),
    };
  }

  @Get('messages')
  async getMessages(): Promise<Paginated<Message>> {
    return {
      items: await this.messageRepository.find(),
    };
  }
}
