import { Module } from '@nestjs/common';
import { SowsService } from './sows.service';
import { SowsController } from './sows.controller';

@Module({
  providers: [SowsService],
  controllers: [SowsController]
})
export class SowsModule {}
