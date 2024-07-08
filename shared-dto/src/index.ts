import { z } from 'zod';

export type Paginated<T> = {
  items: T[];
};

const _UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
});

const MessageSchema = z.object({
  id: z.string().uuid(),
  source: z.string(),
  conversationId: z.string(),
  type: z.string(),
  text: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const MemorySchema = z.object({
  id: z.string().uuid(),
  text: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const _SkillSchema = z.object({
  id: z.string().uuid(),
  skillId: z.string(),
  active: z.boolean(),
});

export const GetSkillSchema = z.object({
  name: z.string(),
  description: z.string(),
  active: z.boolean(),
});

export const JwtTokenSchema = z.object({
  sub: z.string().uuid(),
  role: z.string(),
  iat: z.number(),
  exp: z.number(),
});

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const CreateAgentSchema = z.object({
  name: z.string(),
});

export const UpdateAgentSchema = z.object({
  name: z.string(),
  defaultPrompt: z.string(),
});

export const GetMemorySchema = MemorySchema.extend({
  messages: z.array(MessageSchema),
});
export const GetMessageSchema = MessageSchema;
