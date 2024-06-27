import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

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

  @OneToOne(() => User, (user) => user.agent)
  owner: User;
}
