import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Agent } from './agent.entity';

@Entity()
export class Skill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  skillId: string;

  @OneToOne(() => Agent, (agent) => agent.skills, { onDelete: 'CASCADE' })
  agent: Agent;

  @Column()
  active: boolean = false;
}
