import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { MilestonesSubmissionsService } from './milestones-submissions.service';
import { CreateMilestoneSubmissionDto } from './dto/create-milestone-submission.dto';
import { UpdateMilestoneSubmissionDto } from './dto/update-milestone-submission.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../users/user.entity';
import { ParseUUIDPipe } from '@nestjs/core';

@Controller('milestones-submissions')
export class MilestonesSubmissionsController {
  constructor(
    private readonly milestonesSubmissionsService: MilestonesSubmissionsService,
  ) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @Roles(Role.DEVELOPER) // Only developers can submit milestones
  create(@Body() createMilestoneSubmissionDto: CreateMilestoneSubmissionDto) {
    return this.milestonesSubmissionsService.create(
      createMilestoneSubmissionDto,
    );
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @Roles(Role.ADMIN, Role.SUPER_ADMIN) // Only admins can list all submissions
  findAll() {
    return this.milestonesSubmissionsService.findAll();
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.milestonesSubmissionsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @Roles(Role.ADMIN, Role.SUPER_ADMIN) // Only admins can update submissions (for feedback, etc.)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMilestoneSubmissionDto: UpdateMilestoneSubmissionDto,
  ) {
    return this.milestonesSubmissionsService.update(
      id,
      updateMilestoneSubmissionDto,
    );
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.milestonesSubmissionsService.remove(id);
  }

  // Get submissions by milestone ID
  Get('milestone/:milestoneId')
  @UseGuards(AuthGuard('jwt'))
  findByMilestoneId(@Param('milestoneId', ParseUUIDPipe) milestoneId: string) {
    return this.milestonesSubmissionsService.findByMilestoneId(milestoneId);
  }

  // Get submissions by submitter ID
  Get('submitter/:submitterId')
  @UseGuards(AuthGuard('jwt'))
  findBySubmitterId(@Param('submitterId', ParseUUIDPipe) submitterId: string) {
    return this.milestonesSubmissionsService.findBySubmitterId(submitterId);
  }

  // Approve a submission
  @Patch(':id/approve')
  @UseGuards(AuthGuard('jwt'))
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  approveSubmission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reviewerId') reviewerId: string,
    @Body('feedback') feedback?: string,
  ) {
    return this.milestonesSubmissionsService.approveSubmission(
      id,
      reviewerId,
      feedback,
    );
  }

  // Reject a submission
  @Patch(':id/reject')
  @UseGuards(AuthGuard('jwt'))
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  rejectSubmission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reviewerId') reviewerId: string,
    @Body('feedback') feedback?: string,
  ) {
    return this.milestonesSubmissionsService.rejectSubmission(
      id,
      reviewerId,
      feedback,
    );
  }

  // Request revisions
  @Patch(':id/request-revisions')
  @UseGuards(AuthGuard('jwt'))
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  requestRevisions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('requestedBy') requestedBy: string,
    @Body('feedback') feedback: string,
    @Body('revisionDueDate') revisionDueDate: Date,
  ) {
    return this.milestonesSubmissionsService.requestRevisions(
      id,
      requestedBy,
      feedback,
      revisionDueDate,
    );
  }
}
