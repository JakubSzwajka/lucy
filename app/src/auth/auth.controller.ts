import { Controller, Post, Request, Get, Body } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { Public } from './decorator';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

class RegisterDto extends createZodDto(RegisterSchema) {}

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() body: RegisterDto) {
    return await this.authService.register(body);
  }

  @Public()
  @Post('login')
  async login(@Body() body: RegisterDto) {
    return await this.authService.login(body);
  }

  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }

  // async logout() {
  //   return 'logout';
  // }

  // async forgotPassword() {
  //   return 'forgot-password';
  // }

  // async resetPassword() {
  //   return 'reset-password';
  // }

  // async changePassword() {
  //   return 'change-password';
  // }
}
