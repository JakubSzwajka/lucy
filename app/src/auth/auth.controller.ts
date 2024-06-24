import { Controller, Post, UseGuards, Request, Get } from '@nestjs/common';
import { LocalAuthGuard } from './guards/local.auth.guard';
import { AuthService } from './services/auth.service';
import { JwtAuthGuard } from './guards/jwt.auth.guard';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  async register() {
    return 'register';
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req) {
    return await this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }

  async logout() {
    return 'logout';
  }

  async forgotPassword() {
    return 'forgot-password';
  }

  async resetPassword() {
    return 'reset-password';
  }

  async changePassword() {
    return 'change-password';
  }
}
