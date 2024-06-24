import { OpenAIClient } from '@langchain/openai';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Skill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  description: string;

  @Column('simple-json')
  parameters: OpenAIClient.ChatCompletionTool['function']['parameters'];
}
