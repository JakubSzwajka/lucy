import {
  Controller,
  Post,
  UseGuards,
  Request,
  Get,
  Body,
} from '@nestjs/common';
import { LocalAuthGuard } from './guards/local.auth.guard';
import { AuthService } from './services/auth.service';
import { JwtAuthGuard } from './guards/jwt.auth.guard';
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
