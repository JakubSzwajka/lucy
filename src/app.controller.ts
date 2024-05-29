import { Controller, Post, Body } from '@nestjs/common';
import { LucyService } from './lucy/lucy.service';

@Controller()
export class AppController {
  constructor(private readonly lucy: LucyService) {}

  @Post('/talk')
  async talk(@Body() body: { message: string }): Promise<{
    message: string;
  }> {
    const response = await this.lucy.talk(body.message);
    return {
      message: response,
    };
  }
}
