import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Agent } from './agent.entity';

@Entity()
export class Skill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  skillId: string;

  @ManyToOne(() => Agent, (agent) => agent.skills)
  agent: Agent;

  @Column()
  active: boolean = false;
}
