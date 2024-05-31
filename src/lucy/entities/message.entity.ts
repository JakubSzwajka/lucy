import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum MessageSource {
  SLACK = 'slack',
}

@Entity()
export class Message {
  constructor(partial: Partial<Message>) {
    Object.assign(this, partial);
  }

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'text',
    default: MessageSource.SLACK,
  })
  source: string;

  @Column()
  conversationId: string;

  @Column()
  human: string;

  @Column()
  agent: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
