import { Controller, Get, Post, Body, Headers } from '@nestjs/common';
import { Message } from './entities/message.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Paginated } from 'src/infra/types';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { LucyService, tools } from './lucy.service';

const SkillSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.string(),
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
    const response = await this.lucy.talk(body.message, {
      messageSource: source,
    });
    return {
      message: response,
    };
  }

  @Get('skills')
  async getSkills(): Promise<Paginated<SkillDto>> {
    return {
      items: [
        {
          name: 'Get Tasks',
          description: 'Get a list of tasks',
          parameters: JSON.stringify(tools[0]),
        },
      ],
    };
  }

  @Get('messages')
  async getMessages(): Promise<Paginated<Message>> {
    return {
      items: await this.messageRepository.find(),
    };
  }
}
