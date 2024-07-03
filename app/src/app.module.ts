import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller';
import { LucyModule } from './lucy/lucy.module';
import { APP_GUARD, APP_PIPE, RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { config } from './db';
import { env } from './env';
import { HTTPLoggingMiddleware } from './infra/http.logger';
import { ToolsModule } from './tools/tools.module';
import { AuthModule } from './auth/auth.module';
import { ZodValidationPipe } from 'nestjs-zod';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { ProfileModule } from './profile/profile.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksService } from './infra/tasks.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
    LucyModule,
    ToolsModule,
    ProfileModule,
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
            path: 'auth',
            module: AuthModule,
          },
          {
            path: 'profile',
            module: ProfileModule,
          },
        ],
      },
    ]),
  ],
  controllers: [AppController],
  providers: [
    TasksService,
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
