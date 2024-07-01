import { Body, Controller, Get, Post } from '@nestjs/common';
import { Message } from './entities/message.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Skill } from './entities/skill.entity';
import { Paginated } from 'src/infra/types';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const CreateSkillSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.object({}),
});

class CreateSkillDto extends createZodDto(CreateSkillSchema) {}

@Controller()
export class LucyController {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Skill)
    private readonly skillRepository: Repository<Skill>,
  ) {}

  @Get('skills')
  async getSkills(): Promise<Paginated<Skill>> {
    return {
      items: await this.skillRepository.find(),
    };
  }

  @Post('skills')
  async createSkill(@Body() skill: CreateSkillDto): Promise<Skill> {
    return this.skillRepository.save(skill);
  }

  @Get('messages')
  async getMessages(): Promise<Paginated<Message>> {
    return {
      items: await this.messageRepository.find(),
    };
  }
}
