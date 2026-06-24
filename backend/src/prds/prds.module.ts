import { Module } from '@nestjs/common';
import { PrdsService } from './prds.service';
import { PrdsController } from './prds.controller';

@Module({
  providers: [PrdsService],
  controllers: [PrdsController]
})
export class PrdsModule {}
