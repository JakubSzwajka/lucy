import { Injectable } from '@nestjs/common';
import { Client } from '@notionhq/client';

@Injectable()
export class NotionService extends Client {
    constructor() {
        super({
            auth: process.env.NOTION_TOKEN,
        });
    }
}