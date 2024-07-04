import { Agent } from '@/lucy/lucy/entities/agent.entity';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class AgentService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
  ) {}

  async createAgent({
    name,
    userId,
  }: {
    name: string;
    userId: string;
  }): Promise<Agent> {
    const agent = await this.agentRepository.findOne({
      where: {
        owner: {
          id: userId,
        },
      },
    });

    if (agent) {
      throw new HttpException('Agent already exists', HttpStatus.CONFLICT);
    }

    return await this.agentRepository.save({ name, owner: { id: userId } });
  }

  async updateAgent({
    id,
    name,
    defaultPrompt,
  }: {
    id: string;
    name: string;
    defaultPrompt: string;
  }): Promise<Agent> {
    const agent = await this.agentRepository.findOne({
      where: {
        id,
      },
    });

    if (!agent) {
      throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    }

    return await this.agentRepository.save({
      ...agent,
      name,
      defaultPrompt,
    });
  }
}
