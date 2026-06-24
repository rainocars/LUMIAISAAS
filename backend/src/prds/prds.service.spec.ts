import { Test, TestingModule } from '@nestjs/testing';
import { PrdsService } from './prds.service';

describe('PrdsService', () => {
  let service: PrdsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrdsService],
    }).compile();

    service = module.get<PrdsService>(PrdsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
