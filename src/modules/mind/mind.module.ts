import { Module } from "@nestjs/common";
import { EVENT_HANDLERS } from "./events/handlers";
import { MindService } from "./mind.service";
import { OpenAiModule } from "../openai/openai.module";
import { CqrsModule } from "@nestjs/cqrs";

@Module({
  imports: [
    CqrsModule,
    OpenAiModule,
  ],
  controllers: [],
  providers: [...EVENT_HANDLERS, MindService],
  exports: [],
})
export class MindModule {}
