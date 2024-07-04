import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Agent } from './agent.entity';
import { User } from './user.entity';

export enum MessageSource {
  UNKNOWN = 'unknown',
  MESSANGER = 'messanger',
  SLACK = 'slack',
}

@Entity()
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  source: string;

  @Column()
  conversationId: string;

  @Column()
  humanMessage: string;

  @Column()
  agentMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Agent, (agent) => agent.messages)
  agent: Agent;

  @ManyToOne(() => User, (user) => user.messages)
  user: User;
}
