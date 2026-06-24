import { Test, TestingModule } from '@nestjs/testing';
import { PrdsController } from './prds.controller';

describe('PrdsController', () => {
  let controller: PrdsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrdsController],
    }).compile();

    controller = module.get<PrdsController>(PrdsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
