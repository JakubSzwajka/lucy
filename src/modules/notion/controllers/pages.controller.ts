import { Controller, Get, Param } from "@nestjs/common";
import { NotionService } from "../services/notionClient";


@Controller('pages')
export class PagesController {
    constructor(
        private readonly notion: NotionService,
        ) { }

    @Get(":pageId")
    public async getPage(@Param('pageId') pageId: string): Promise<any> {
        return await this.notion.pages.retrieve({
            page_id: pageId,
        });
    }
}