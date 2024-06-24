import { AppModule } from '@/lucy/app.module';
import { AuthController } from '../auth.controller';
import { TestingModule, Test } from '@nestjs/testing';
import { AuthService } from '../services/auth.service';
import { User } from '@/lucy/lucy/entities/user.entity';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let user: User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
