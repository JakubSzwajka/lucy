import { Module } from '@nestjs/common';
import { LucyService } from './services/lucy.service';
import { Message } from './entities/message.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ToolsModule } from '@/lucy/tools/tools.module';
import { LucyController } from './lucy.controller';
import { Skill } from './entities/skill.entity';
import { Agent } from './entities/agent.entity';
import { ToolsService } from './services/tools.service';
import { ConversationService } from './services/conversation.service';
import { EVENT_HANDLERS } from './handlers';
import { CqrsModule } from '@nestjs/cqrs';
import { MemoriesService } from './services/memories.service';
import { Memory } from './entities/memory.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, Skill, Agent, Memory]),
    ToolsModule,
    CqrsModule,
  ],
  providers: [
    LucyService,
    ToolsService,
    MemoriesService,
    ConversationService,
    ...EVENT_HANDLERS,
  ],
  exports: [LucyService],
  controllers: [LucyController],
})
export class LucyModule {}
