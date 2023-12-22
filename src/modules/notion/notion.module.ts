import { Module } from '@nestjs/common';
import { NotionService } from './services/notionClient';
import { NotionController } from './controllers/database.controller';
import { PagesController } from './controllers/pages.controller';

@Module({
  imports: [],
  controllers: [
    NotionController,
    PagesController,
  ],
  providers: [
    NotionService
  ],
})
export class NotionModule {}