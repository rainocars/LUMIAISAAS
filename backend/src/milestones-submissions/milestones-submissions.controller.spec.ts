import { Test, TestingModule } from '@nestjs/testing';
import { MilestonesSubmissionsController } from './milestones-submissions.controller';

describe('MilestonesSubmissionsController', () => {
  let controller: MilestonesSubmissionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MilestonesSubmissionsController],
    }).compile();

    controller = module.get<MilestonesSubmissionsController>(MilestonesSubmissionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
