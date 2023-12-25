import { Module } from "@nestjs/common";
import { NotionModule } from "./modules/notion/notion.module";
import { AppController } from "./app.controller";
import { RouterModule } from "@nestjs/core";

@Module({
  imports: [
    NotionModule,
    RouterModule.register([
      {
        path: "v1",
        module: NotionModule,
      },
    ]),
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
