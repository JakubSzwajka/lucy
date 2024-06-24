import { AuthService } from '../services/auth.service';
import { AppModule } from '@/lucy/app.module';
import { Test, TestingModule } from '@nestjs/testing';
import { faker } from '@faker-js/faker';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    service = app.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerUser', () => {
    it('should register a new user', async () => {
      const user = await service.register({
        email: faker.internet.email(),
        password: faker.internet.password(),
      });

      expect(user).toEqual(
        expect.objectContaining({
          access_token: expect.any(String),
        }),
      );
    });
  });

  describe('login', () => {
    it('should login a user', async () => {
      const email = faker.internet.email();
      const password = faker.internet.password();
      await service.register({ email, password });

      const user = await service.login({ email, password });

      expect(user).toEqual(
        expect.objectContaining({
          access_token: expect.any(String),
        }),
      );
    });

    it('should throw an error if the email is not found', async () => {
      const email = faker.internet.email();
      const password = faker.internet.password();

      try {
        await service.login({ email, password });
      } catch (error) {
        expect(error.message).toBe('Unauthorized');
      }
    });

    it('should throw an error if the password is incorrect', async () => {
      const email = faker.internet.email();
      const password = faker.internet.password();
      await service.register({ email, password });

      try {
        await service.login({ email, password: faker.internet.password() });
      } catch (error) {
        expect(error.message).toBe('Unauthorized');
      }
    });
  });
});
