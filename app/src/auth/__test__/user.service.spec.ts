import { AppModule } from '@/lucy/app.module';
import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from '../services/user.service';
import { faker } from '@faker-js/faker';

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    service = app.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const user = await service.createUser({
        email: faker.internet.email(),
        password: faker.internet.password(),
      });

      expect(user).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          email: user.email,
        }),
      );

      const userFromDb = await service.getUserByEmail(user.email);

      expect(userFromDb).toEqual(
        expect.objectContaining({
          id: user.id,
          email: user.email,
        }),
      );
    });

    it('should throw an error if the email is already taken', async () => {
      const email = faker.internet.email();
      const password = faker.internet.password();
      await service.createUser({ email, password });

      try {
        await service.createUser({
          email,
          password,
        });
      } catch (error: any) {
        expect(error.message).toBe('User with this email already exists');
      }
    });
  });
});
