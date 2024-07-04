import { Column, Entity, OneToOne, PrimaryGeneratedColumn, JoinColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { Skill } from './skill.entity';
import { Message } from './message.entity';

@Entity()
export class Agent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  defaultPrompt: string;

  @Column({ nullable: true })
  preferredChannel: string;

  @OneToOne(() => User, (user) => user.agent, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  owner: User;

  @OneToOne(() => Skill, (skill) => skill.agent)
  skills: Skill[];

  @OneToMany(() => Message, (message) => message.agent)
  messages: Message[]
}
