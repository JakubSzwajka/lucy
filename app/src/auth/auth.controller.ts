import { Controller, Post, Request, Get, Body, Res } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { Public } from './decorator';
import { createZodDto } from 'nestjs-zod';
import { Response } from 'express';
import { env } from '../env';
import { RegisterSchema, LoginSchema } from 'shared-dto';

class LoginDto extends createZodDto(LoginSchema) {}
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
  async login(@Body() body: LoginDto, @Res() res: Response) {
    const { accessToken } = await this.authService.login(body);

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
    return res.status(200).send({ message: 'Login successful' });
  }

  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }

  @Post('logout')
  async logout(@Res() res: Response) {
    res.clearCookie('accessToken');
    return res.status(200).send({ message: 'Logout successful' });
  }
}
