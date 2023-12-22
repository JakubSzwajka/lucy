import { Module } from '@nestjs/common';
import { NotionModule } from './modules/notion/notion.module';
import { AppController } from './app.controller';

@Module({
  imports: [NotionModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}