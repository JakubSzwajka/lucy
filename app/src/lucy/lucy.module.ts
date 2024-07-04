import { Module } from '@nestjs/common';
import { LucyService } from './lucy.service';
import { Message } from './entities/message.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LucyToolset } from './lucy.toolset';
import { ToolsModule } from '@/lucy/tools/tools.module';
import { LucyController } from './lucy.controller';
import { Skill } from './entities/skill.entity';
import { Agent } from './entities/agent.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Message, Skill, Agent]), ToolsModule],
  providers: [LucyService, LucyToolset],
  exports: [LucyService],
  controllers: [LucyController],
})
export class LucyModule {}
