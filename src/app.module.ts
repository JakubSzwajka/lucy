import { Module } from '@nestjs/common';
import { NotionModule } from './modules/notion/notion.module';

@Module({
  imports: [NotionModule],
  controllers: [],
  providers: [],
})
export class AppModule {}