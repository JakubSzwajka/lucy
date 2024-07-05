import {
  Column,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Agent } from './agent.entity';
import { Message } from './message.entity';
import { Memory } from './memory.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column()
  password: string;

  @OneToOne(() => Agent, (agent) => agent.owner)
  agent: Agent;

  @OneToMany(() => Message, (message) => message.user)
  messages: Message[];

  @OneToMany(() => Memory, (memory) => memory.user)
  memories: Memory[];
}
