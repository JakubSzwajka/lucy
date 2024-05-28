import { Controller, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { call } from './ai/llm';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('/talk')
  async talk(@Body() body: { message: string }): Promise<{
    message: string;
  }> {
    const response = await call(body.message);
    return {
      message: response,
    };
  }
}
