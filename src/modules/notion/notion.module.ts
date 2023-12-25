import { Module } from '@nestjs/common';
import { NotionService } from './services/notionClient';
import { DatabaseController } from './controllers/database.controller';
import { PagesController } from './controllers/pages.controller';

@Module({
  imports: [],
  controllers: [
    DatabaseController,
    PagesController,
  ],
  providers: [
    NotionService
  ],
})
export class NotionModule {}