import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LucyModule } from './lucy/lucy.module';
import { SlackModule } from './slack/slackModule';

@Module({
  imports: [LucyModule, SlackModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
