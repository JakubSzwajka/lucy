import { Controller, Get, Param } from "@nestjs/common";
import { NotionService } from "../services/notionClient";
import { GetDatabaseResponse, QueryDatabaseResponse } from "@notionhq/client/build/src/api-endpoints";
import { ApiBearerAuth } from "@nestjs/swagger";

@Controller("database")
@ApiBearerAuth("JWT-auth")
export class DatabaseController {
  constructor(private readonly notion: NotionService) {}

  @Get(":databaseId")
  public async getDatabase(@Param("databaseId") databaseId: string): Promise<GetDatabaseResponse | unknown> {
    try {
      return await this.notion.databases.retrieve({
        database_id: databaseId,
      });
    } catch (e) {
      console.error(e);
      return e;
    }
  }

  @Get(":databaseId/items")
  public async getDatabaseItems(@Param("databaseId") databaseId: string): Promise<QueryDatabaseResponse | unknown> {
    try {
      return await this.notion.databases.query({
        database_id: databaseId,
      });
    } catch (e) {
      console.error(e);
      return e;
    }
  }
}
