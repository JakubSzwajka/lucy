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
import { createZodDto } from 'nestjs-zod';
import { LucyService } from './services/lucy.service';
import { Agent } from './entities/agent.entity';
import { Skill } from './entities/skill.entity';
import { ToolsService } from './services/tools.service';
import { Memory } from './entities/memory.entity';
import { GetSkillSchema, Paginated, GetMemorySchema } from 'shared-dto';

class GetSkillDto extends createZodDto(GetSkillSchema) {}
class GetMemoryDto extends createZodDto(GetMemorySchema) {}

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
    private readonly toolsService: ToolsService,
    @InjectRepository(Memory)
    private readonly memoryRepository: Repository<Memory>,
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
      user: request.user,
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
  async getSkills(@Request() req): Promise<Paginated<GetSkillDto>> {
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
      items: this.toolsService.skills.map((skill) => ({
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

  @Get('memories')
  async getMemories(@Request() req): Promise<Paginated<GetMemoryDto>> {
    const memories = await this.memoryRepository.find({
      where: {
        user: {
          id: req.user.id,
        },
      },
      relations: ['messages'],
      order: {
        createdAt: 'DESC',
      },
    });
    return {
      items: memories.map((memory) => ({
        id: memory.id,
        text: memory.text,
        createdAt: memory.createdAt.toISOString(),
        updatedAt: memory.updatedAt.toISOString(),
        messages: memory.messages.map((message) => ({
          id: message.id,
          source: message.source,
          conversationId: message.conversationId,
          type: message.type,
          text: message.text,
          createdAt: message.createdAt.toISOString(),
          updatedAt: message.updatedAt.toISOString(),
        })),
      })),
    };
  }

  @Delete('memories')
  async deleteMemories(@Request() req): Promise<string> {
    await this.memoryRepository.delete({
      user: {
        id: req.user.id,
      },
    });
    return 'ok';
  }

  @Delete('memories/:memoryId')
  async deleteMemory(
    @Request() req,
    @Param('memoryId') memoryId: string,
  ): Promise<string> {
    await this.memoryRepository.delete({
      id: memoryId,
      user: {
        id: req.user.id,
      },
    });
    return 'ok';
  }
}
