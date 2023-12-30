import { MiddlewareConsumer, Module, RequestMethod } from "@nestjs/common";
import { NotionModule } from "./modules/notion/notion.module";
import { AppController } from "./app.controller";
import { APP_GUARD, RouterModule } from "@nestjs/core";
import { OpenAiModule } from "./modules/openai/openai.module";
import { SlackModule } from "./modules/slack/slack.module";
import { LoggingMiddleware } from "./modules/infra/middleware/logging";
import { AuthGuard } from "./modules/notion/guard/auth.guard";
import { MindModule } from "./modules/mind/mind.module";

@Module({
  imports: [
    NotionModule,
    OpenAiModule,
    SlackModule,
    MindModule,
    RouterModule.register([
      {
        path: "v1",
        module: NotionModule,
        children: [
          {
            path: "notion",
            module: NotionModule,
          },
          {
            path: "slack",
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
    consumer.apply(LoggingMiddleware).forRoutes({
      path: "*",
      method: RequestMethod.ALL,
    });
  }
}
