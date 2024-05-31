import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller';
import { LucyModule } from './lucy/lucy.module';
import { SlackModule } from './slack/slackModule';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './app.guard';
import { TypeOrmModule } from '@nestjs/typeorm';
import { config } from './db';
import { env } from './env';
import { HTTPLoggingMiddleware } from './infra/http.logger';

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
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HTTPLoggingMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });
  }
}
