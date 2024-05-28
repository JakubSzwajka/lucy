import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { LucyModule } from './lucy/lucy.module';
import { SlackModule } from './slack/slackModule';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './app.guard';

@Module({
  imports: [LucyModule, SlackModule],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
