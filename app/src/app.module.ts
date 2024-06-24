import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller';
import { LucyModule } from './lucy/lucy.module';
import { SlackModule } from './slack/slackModule';
import { APP_GUARD, RouterModule } from '@nestjs/core';
import { AuthGuard } from './app.guard';
import { TypeOrmModule } from '@nestjs/typeorm';
import { config } from './db';
import { env } from './env';
import { HTTPLoggingMiddleware } from './infra/http.logger';
import { ToolsModule } from './tools/tools.module';

@Module({
  imports: [
    LucyModule,
    SlackModule,
    ToolsModule,
    TypeOrmModule.forRoot(config[env.NODE_ENV]),
    RouterModule.register([
      {
        path: 'api',
        children: [
          {
            path: 'lucy',
            module: LucyModule,
          },
          {
            path: '',
            module: SlackModule,
          },
        ],
      },
    ]),
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
