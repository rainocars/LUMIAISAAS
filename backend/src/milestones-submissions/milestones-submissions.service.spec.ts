import { Test, TestingModule } from '@nestjs/testing';
import { MilestonesSubmissionsService } from './milestones-submissions.service';

describe('MilestonesSubmissionsService', () => {
  let service: MilestonesSubmissionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MilestonesSubmissionsService],
    }).compile();

    service = module.get<MilestonesSubmissionsService>(MilestonesSubmissionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
