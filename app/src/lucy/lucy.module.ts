import { Module } from '@nestjs/common';
import { LucyService } from './lucy.service';
import { Message } from './entities/message.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LucyToolset } from './lucy.toolset';
import { ToolsModule } from 'src/tools/tools.module';
import { LucyController } from './lucy.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Message]), ToolsModule],
  providers: [LucyService, LucyToolset],
  exports: [LucyService],
  controllers: [LucyController],
})
export class LucyModule {}
