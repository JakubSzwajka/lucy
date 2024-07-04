import { Agent } from '@/lucy/lucy/entities/agent.entity';
import { Controller, Request, Get, Post, Body, Patch } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentService } from '../services/agent.service';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const CreateAgentSchema = z.object({
  name: z.string(),
});

class CreateAgentDto extends createZodDto(CreateAgentSchema) {}

const UpdateAgentSchema = z.object({
  name: z.string(),
  defaultPrompt: z.string(),
});

class UpdateAgentDto extends createZodDto(UpdateAgentSchema) {}

@Controller()
export class ProfileController {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    private readonly agentService: AgentService,
  ) {}

  @Get()
  getProfile(@Request() req) {
    return req.user;
  }

  @Get('active-agent')
  async getActiveAgent(@Request() req): Promise<Agent | object> {
    const { id } = req.user;
    const agent = await this.agentRepository.findOne({
      where: {
        owner: {
          id,
        },
      },
    });
    return agent || {};
  }

  @Post('agents')
  async createAgent(
    @Request() req,
    @Body() body: CreateAgentDto,
  ): Promise<Agent> {
    const { id } = req.user;
    return await this.agentService.createAgent({
      name: body.name,
      userId: id,
    });
  }

  @Patch('agents/:id')
  async updateAgent(
    @Request() req,
    @Body() body: UpdateAgentDto,
  ): Promise<Agent> {
    const { id } = req.params;
    return await this.agentService.updateAgent({
      id,
      name: body.name,
      defaultPrompt: body.defaultPrompt,
    });
  }
}
