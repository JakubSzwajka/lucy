import { Module } from '@nestjs/common';
import { LucyService } from './lucy.service';
import { Message } from './entities/message.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Message])],
  providers: [LucyService],
  exports: [LucyService],
})
export class LucyModule {}
