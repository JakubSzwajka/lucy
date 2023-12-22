import { Module } from '@nestjs/common';
import { NotionService } from './services/notionClient';
import { NotionController } from './controllers/database.controller';

@Module({
  imports: [],
  controllers: [
    NotionController
  ],
  providers: [
    NotionService
  ],
})
export class NotionModule {}