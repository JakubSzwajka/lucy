import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Agent } from './agent.entity';

@Entity()
export class User {
  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column()
  password: string;

  @OneToOne(() => Agent, (agent) => agent.owner)
  agent: Agent;
}
