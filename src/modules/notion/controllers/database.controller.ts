import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { NotionService } from "../services/notionClient";
import { GetDatabaseResponse } from "@notionhq/client/build/src/api-endpoints";
import { AuthGuard } from "../guard/auth.guard";
import { ApiBasicAuth, ApiBearerAuth } from "@nestjs/swagger";


@Controller('database')
@ApiBearerAuth('JWT-auth')
export class NotionController {
    constructor(
        private readonly notion: NotionService,
    ) { }

    @Get(":databaseId")
    public async getDatabase(@Param('databaseId') databaseId: string): Promise<GetDatabaseResponse> {
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