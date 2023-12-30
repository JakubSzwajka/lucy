import { Module } from "@nestjs/common";
import { SlackController } from "./message.controller";
import { SlackWebClient } from "./slack.servcie";
import { CqrsModule } from "@nestjs/cqrs";
import { EVENT_HANDLERS } from "./events/handlers";



@Module({
    imports: [
        CqrsModule,
    ],
    controllers: [
        SlackController
    ],
    providers: [
        ...EVENT_HANDLERS,
        SlackWebClient
    ],
    exports: []
})
export class SlackModule {}