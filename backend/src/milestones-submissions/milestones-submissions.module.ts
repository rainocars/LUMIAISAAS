import { Module } from '@nestjs/common';
import { MilestonesSubmissionsService } from './milestones-submissions.service';
import { MilestonesSubmissionsController } from './milestones-submissions.controller';

@Module({
  providers: [MilestonesSubmissionsService],
  controllers: [MilestonesSubmissionsController]
})
export class MilestonesSubmissionsModule {}
