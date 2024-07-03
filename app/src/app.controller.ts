import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorator';

@Controller()
export class AppController {
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
