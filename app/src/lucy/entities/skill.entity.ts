import { OpenAIClient } from '@langchain/openai';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Skill {
  constructor(partial: Partial<Skill>) {
    Object.assign(this, partial);
  }

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  description: string;

  @Column('simple-json')
  parameters: OpenAIClient.ChatCompletionTool['function']['parameters'];
}
