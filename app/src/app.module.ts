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
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    LucyModule,
    SlackModule,
    ToolsModule,
    TypeOrmModule.forRoot(config[env.NODE_ENV]),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'web/build'),
    }),
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
