import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Request,
  HttpException,
  HttpStatus,
  Param,
  Delete,
} from '@nestjs/common';
import { Message } from './entities/message.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Paginated } from 'src/infra/types';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { LucyService } from './lucy.service';
import { skills } from './lucy.tools';
import { Agent } from './entities/agent.entity';
import { Skill } from './entities/skill.entity';

const SkillSchema = z.object({
  name: z.string(),
  description: z.string(),
  active: z.boolean(),
});

class SkillDto extends createZodDto(SkillSchema) {}

@Controller()
export class LucyController {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly lucy: LucyService,
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    @InjectRepository(Skill)
    private readonly skillRepository: Repository<Skill>,
  ) {}

  @Post('talk')
  async talk(
    @Body() body: { message: string },
    @Headers() headers,
    @Request() request,
  ): Promise<{
    message: string;
  }> {
    const source = headers['x-message-source'];
    const conversationId = headers['x-conversation-id'];
    const agent = await this.agentRepository.findOne({
      where: {
        owner: {
          id: request.user.id,
        },
      },
      relations: ['skills', 'owner'],
    });

    if (!agent) {
      throw new HttpException('Agent not found', HttpStatus.BAD_REQUEST);
    }

    const response = await this.lucy.talk({
      query: body.message,
      agent,
      options: {
        messageSource: source,
        conversationId,
      },
    });
    return {
      message: response,
    };
  }

  @Get('skills')
  async getSkills(@Request() req): Promise<Paginated<SkillDto>> {
    const agent = await this.agentRepository.findOne({
      where: {
        owner: {
          id: req.user.id,
        },
      },
      relations: ['skills'],
    });

    if (!agent) {
      return {
        items: [],
      };
    }
    const agentSkillsIds = agent.skills
      .filter((skill) => skill.active)
      .map((skill) => skill.skillId);

    return {
      items: skills.map((skill) => ({
        name: skill.name,
        description: skill.description,
        active: agentSkillsIds.includes(skill.name),
      })),
    };
  }

  @Post('skills/:skillId/toggle')
  async toggleSkill(
    @Request() req,
    @Param('skillId') skillId: string,
  ): Promise<string> {
    const userId = req.user.id;
    const agent = await this.agentRepository.findOne({
      where: {
        owner: {
          id: userId,
        },
      },
      relations: ['skills'],
    });

    if (!agent) {
      throw new HttpException('Agent not found', HttpStatus.BAD_REQUEST);
    }

    const skillAssignedToAgent = agent.skills.find(
      (skill) => skill.skillId === skillId,
    );

    if (skillAssignedToAgent) {
      // toggle
      await this.skillRepository.update(skillAssignedToAgent.id, {
        active: !skillAssignedToAgent.active,
      });
    } else {
      await this.skillRepository.insert({
        agent,
        skillId,
        active: true,
      });
    }

    return 'ok';
  }

  @Delete('messages')
  async deleteMessages(): Promise<string> {
    await this.messageRepository.delete({});
    return 'ok';
  }

  @Get('messages')
  async getMessages(): Promise<Paginated<Message>> {
    return {
      items: await this.messageRepository.find({
        order: {
          createdAt: 'DESC',
        },
      }),
    };
  }
}
