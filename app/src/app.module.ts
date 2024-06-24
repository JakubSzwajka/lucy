import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller';
import { LucyModule } from './lucy/lucy.module';
import { SlackModule } from './slack/slackModule';
import { APP_GUARD, APP_PIPE, RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { config } from './db';
import { env } from './env';
import { HTTPLoggingMiddleware } from './infra/http.logger';
import { ToolsModule } from './tools/tools.module';
import { AuthModule } from './auth/auth.module';
import { ZodValidationPipe } from 'nestjs-zod';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Module({
  imports: [
    AuthModule,
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
          {
            path: 'auth',
            module: AuthModule,
          },
        ],
      },
    ]),
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
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
