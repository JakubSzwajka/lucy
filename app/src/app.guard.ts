import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { env } from './env';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly TOKEN = env.AUTH_TOKEN;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (authHeader && authHeader === `Bearer ${this.TOKEN}`) {
      return true;
    }
    throw new UnauthorizedException('Forbidden');
  }
}
