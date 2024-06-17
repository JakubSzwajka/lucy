import { Controller, Get } from '@nestjs/common';

@Controller()
export class LucyController {
  @Get('skill')
  getHello(): string {
    return 'Hello World!';
  }
}
