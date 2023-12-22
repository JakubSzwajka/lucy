import { Controller, Get, Param } from "@nestjs/common";
import { NotionService } from "../services/notionClient";


@Controller('database')
export class NotionController {
    constructor(
        private readonly notion: NotionService,
    ) { }

    @Get(":databaseId")
    public async getDatabase(@Param('databaseId') databaseId: string): Promise<any> {
        return await this.notion.databases.retrieve({
            database_id: databaseId,
        });
    }

    @Get(":databaseId/items")
    public async getDatabaseItems(@Param('databaseId') databaseId: string): Promise<any> {
        return await this.notion.databases.query({
            database_id: databaseId,
        });
    }
}