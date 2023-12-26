import { Module } from '@nestjs/common';
import { NotionService } from './services/notionClient';
import { DatabaseController } from './controllers/database.controller';
import { PagesController } from './controllers/pages.controller';
import { ProjectsController } from './controllers/project.controller';

@Module({
  imports: [],
  controllers: [
    DatabaseController,
    PagesController,
    ProjectsController
  ],
  providers: [
    NotionService
  ],
})
export class NotionModule {}