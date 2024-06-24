import { Test, TestingModule } from '@nestjs/testing';
import { LucyController } from '../lucy.controller';
import { AppModule } from '@/lucy/app.module';
import { Skill } from '../entities/skill.entity';
import { faker } from '@faker-js/faker';

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
      expect(await controller.getSkills()).toEqual({
        items: [],
      });
    });

    it('should create a new skill', async () => {
      let skill = new Skill({
        name: faker.lorem.word(),
        description: faker.lorem.sentence(),
        parameters: {},
      });
      skill = await controller.createSkill(skill);

      expect(skill).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: skill.name,
          description: skill.description,
          parameters: skill.parameters,
        }),
      );
    });
  });
});
