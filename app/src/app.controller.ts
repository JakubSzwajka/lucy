import { Controller, Post, Body, Get } from '@nestjs/common';
import { LucyService } from './lucy/lucy.service';
import { Public } from './auth/decorator';

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

  @Public()
  @Get()
  async getWebhook() {
    return 'Hello World';
  }

  @Public()
  @Get('favicon.ico')
  async getFavicon() {
    return '';
  }
  @Public()
  @Get('apple-touch-icon.png')
  async getAppleTouchIcon() {
    return '';
  }
  @Public()
  @Get('apple-touch-icon-precomposed.png')
  async getAppleTouchIconPrecomposed() {
    return '';
  }
}
