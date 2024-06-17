import { Test, TestingModule } from '@nestjs/testing';
import { LucyController } from '../lucy.controller';
import { env } from '@/lucy/env';
import { AppModule } from '@/lucy/app.module';

describe('LucyController', () => {
  let controller: LucyController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    controller = app.get<LucyController>(LucyController);
  });

  describe('getSkills', () => {
    it('should return a list of skills', async () => {
      console.log('NODE ENV: ', env.NODE_ENV);
      expect(await controller.getSkills()).toEqual({
        items: [],
      });
    });
  });
});
