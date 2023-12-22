import { Controller, Get, Param } from "@nestjs/common";
import { NotionService } from "../services/notionClient";
import { ApiBearerAuth } from "@nestjs/swagger";
import { PageBlock } from "../services/blockInterpreter";

@Controller("pages")
@ApiBearerAuth("JWT-auth")
export class PagesController {
  constructor(private readonly notion: NotionService,
    ) {}

  @Get(":pageId")
  public async getPage(@Param("pageId") pageId: string): Promise<string> {
    const page = await this.notion.blocks.children.list({
        block_id: pageId,
    });
    return new PageBlock(page.results).toMarkdown();
  }
}
