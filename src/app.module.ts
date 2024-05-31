import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { LucyModule } from './lucy/lucy.module';
import { SlackModule } from './slack/slackModule';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './app.guard';
import { TypeOrmModule } from '@nestjs/typeorm';
import { config } from './db';
import { env } from './env';

@Module({
  imports: [
    LucyModule,
    SlackModule,
    TypeOrmModule.forRoot(config[env.NODE_ENV]),
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
