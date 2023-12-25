import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { NotionService } from "../services/notionClient";
import { ApiBearerAuth, ApiBody, ApiProperty } from "@nestjs/swagger";
import { PageBlock } from "../services/blockInterpreter";
import { ListBlockChildrenResponse, UpdatePageParameters } from "@notionhq/client/build/src/api-endpoints";


class UpdatePageParametersDTO implements Partial<UpdatePageParameters> {
  @ApiProperty()
  public readonly archived: boolean = false;

  @ApiProperty()
  public readonly properties: UpdatePageParameters['properties'];

}

@Controller("pages")
@ApiBearerAuth("JWT-auth")
export class PagesController {
  constructor(private readonly notion: NotionService) {}

  @Get(":pageId")
  public async getPage(@Param("pageId") pageId: string): Promise<ListBlockChildrenResponse> {
    return await this.notion.blocks.children.list({
      block_id: pageId,
    });
  }

  @Get(":pageId/markdown")
  public async getPageMarkdown(@Param("pageId") pageId: string): Promise<string> {
    const page = await this.notion.blocks.children.list({
      block_id: pageId,
    });
    return new PageBlock(page.results).toMarkdown();
  }

  @Patch(":pageId")
  @ApiBody({ type: UpdatePageParametersDTO })
  public async updatePage(@Param("pageId") pageId: string, @Body() body: UpdatePageParameters) {
    console.log(body);
    try {
        return await this.notion.pages.update({
          ...body,
          page_id: pageId,
        });
    } catch (e) {
        console.error(e);
        return e;
    }
  }
}
