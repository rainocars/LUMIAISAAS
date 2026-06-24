import { Test, TestingModule } from '@nestjs/testing';
import { SowsController } from './sows.controller';

describe('SowsController', () => {
  let controller: SowsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SowsController],
    }).compile();

    controller = module.get<SowsController>(SowsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
