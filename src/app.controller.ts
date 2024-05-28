import { Controller, Post, Body } from '@nestjs/common';
import { call } from './ai/llm';

@Controller()
export class AppController {
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
