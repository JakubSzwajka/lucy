import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { User } from '@/lucy/lucy/entities/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './services/user.service';
import { env } from '../env';
import { JwtStrategy } from './strategies/jwt-auth.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule,
    JwtModule.register({
      secret: env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: '60m' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, UserService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
