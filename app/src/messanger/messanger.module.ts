import { Module } from '@nestjs/common';
import { MessangerController } from './messanger.controller';

@Module({
  controllers: [MessangerController],
})
export class MessangerModule {}
