import { Injectable } from '@nestjs/common';
import { Client } from '@notionhq/client';
import { env } from '../../../env';

@Injectable()
export class NotionService extends Client {
    constructor() {
        super({
            auth: env.NOTION_TOKEN,
        });
    }
}