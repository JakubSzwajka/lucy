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
    description,
    defaultPrompt,
    preferredChannel,
  }: {
    id: string;
    name: string;
    description: string;
    defaultPrompt: string;
    preferredChannel: string;
  }): Promise<Agent> {
    const agent = await this.agentRepository.findOne({
      where: {
        id,
      },
    });

    if (!agent) {
      throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    }

    console.log(preferredChannel);
    return await this.agentRepository.save({
      ...agent,
      name,
      description,
      defaultPrompt,
      preferredChannel,
    });
  }
}
