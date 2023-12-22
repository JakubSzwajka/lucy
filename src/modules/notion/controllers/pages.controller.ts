import { Controller, Get, Param } from "@nestjs/common";
import { NotionService } from "../services/notionClient";
import { ApiBearerAuth } from "@nestjs/swagger";
import { GetPageResponse } from "@notionhq/client/build/src/api-endpoints";


@Controller('pages')
@ApiBearerAuth("JWT-auth")
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