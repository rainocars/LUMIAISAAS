import { Test, TestingModule } from '@nestjs/testing';
import { SowsService } from './sows.service';

describe('SowsService', () => {
  let service: SowsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SowsService],
    }).compile();

    service = module.get<SowsService>(SowsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
