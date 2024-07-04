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

export enum MessageType {
  HUMAN = 'human',
  AGENT = 'agent',
  TOOL = 'tool',
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
  type: string;

  @Column()
  text: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Agent, (agent) => agent.messages, { nullable: true })
  agent: Agent;

  @ManyToOne(() => User, (user) => user.messages, { nullable: true })
  user: User;
}
