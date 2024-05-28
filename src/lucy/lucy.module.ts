import { Module } from '@nestjs/common';
import { LucyService } from './lucy.service';

@Module({
  providers: [LucyService],
  exports: [LucyService],
})
export class LucyModule {}
