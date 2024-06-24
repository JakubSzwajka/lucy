import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../lucy/entities/user.entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UserService } from './user.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private jwtService: JwtService,
    private userService: UserService,
  ) {}

  async login(payload: { email: string; password: string }) {
    const user = await this.validateUser(payload.email, payload.password);
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      access_token: this.jwtService.sign({
        email: user.email,
        sub: user.id,
      }),
    };
  }

  async register(data: { email: string; password: string }) {
    const hashedPassword = await this.hashPassword(data.password);
    const user = await this.userService.createUser({
      ...data,
      password: hashedPassword,
    });
    return this.login({
      email: user.email,
      password: data.password,
    });
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<Omit<User, 'password'> | null> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException();
    }
    const isPasswordMatching = await bcrypt.compare(password, user.password);
    if (isPasswordMatching) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  private async hashPassword(password: string) {
    return await bcrypt.hash(password, 10);
  }
}
