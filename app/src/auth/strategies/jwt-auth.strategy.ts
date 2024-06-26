import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { env } from '@/lucy/env';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@/lucy/lucy/entities/user.entity';
import { Repository } from 'typeorm';
import { z } from 'zod';

const JwtTokenSchema = z.object({
  sub: z.string().uuid(),
  role: z.string(),
  iat: z.number(),
  exp: z.number(),
});

type JwtToken = z.infer<typeof JwtTokenSchema>;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private readonly authSessionRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request) => {
          let token = null;
          if (request && request.cookies) {
            token = request.cookies['accessToken'];
          }
          return token;
        },
      ]),
      secretOrKey: env.JWT_ACCESS_SECRET,
    });
  }

  async validate(payload: JwtToken) {
    const user = await this.authSessionRepository.findOne({
      where: { id: payload.sub },
    });
    if (user) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...result } = user;

      return result;
    }
    return null;
  }
}
