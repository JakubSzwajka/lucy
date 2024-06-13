import { Module } from '@nestjs/common';
import { LucyService } from './lucy.service';
import { Message } from './entities/message.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LucyToolset } from './lucy.toolset';
import { ToolsModule } from 'src/tools/tools.module';

@Module({
  imports: [TypeOrmModule.forFeature([Message]), ToolsModule],
  providers: [LucyService, LucyToolset],
  exports: [LucyService],
})
export class LucyModule {}
