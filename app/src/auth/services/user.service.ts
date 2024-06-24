import { User } from '@/lucy/lucy/entities/user.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createUser(data: { email: string; password: string }): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { email: data.email },
    });

    if (user) {
      throw new Error('User with this email already exists');
    }
    return await this.userRepository.save(data);
  }

  async getUserByEmail(email: string): Promise<User> {
    return await this.userRepository.findOne({ where: { email } });
  }
}
