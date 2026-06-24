import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateMilestoneSubmissionDto, UpdateMilestoneSubmissionDto } from './dto/create-milestone-submission.dto';

@Injectable()
export class MilestonesSubmissionsService {
  constructor(private prisma: PrismaService) {}

  async create(createMilestoneSubmissionDto: CreateMilestoneSubmissionDto) {
    // Check if the milestone exists and is in a state that allows submission
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: createMilestoneSubmissionDto.milestoneId },
    });

    if (!milestone) {
      throw new NotFoundException(`Milestone with ID ${createMilestoneSubmissionDto.milestoneId} not found`);
    }

    // Check if a submission already exists for this milestone
    const existingSubmission = await this.prisma.milestoneSubmission.findUnique({
      where: { milestoneId: createMilestoneSubmissionDto.milestoneId },
    });

    if (existingSubmission) {
      throw new Error(`Submission already exists for milestone ${createMilestoneSubmissionDto.milestoneId}`);
    }

    return this.prisma.milestoneSubmission.create({
      data: {
        ...createMilestoneSubmissionDto,
        submittedAt: new Date(),
        status: 'PENDING',
      },
    });
  }

  async findAll() {
    return this.prisma.milestoneSubmission.findMany({
      where: {},
      include: {
        milestone: true,
        submitter: true,
        reviewer: true,
        requestedByUser: true,
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const submission = await this.prisma.milestoneSubmission.findUnique({
      where: { id },
      include: {
        milestone: true,
        submitter: true,
        reviewer: true,
        requestedByUser: true,
      },
    });

    if (!submission) {
      throw new NotFoundException(`Milestone submission with ID ${id} not found`);
    }
    return submission;
  }

  async update(id: string, updateMilestoneSubmissionDto: UpdateMilestoneSubmissionDto) {
    const existingSubmission = await this.findOne(id);
    return this.prisma.milestoneSubmission.update({
      where: { id },
      data: updateMilestoneSubmissionDto,
    });
  }

  async remove(id: string) {
    const existingSubmission = await this.findOne(id);
    return this.prisma.milestoneSubmission.delete({
      where: { id },
    });
  }

  // Get submissions by milestone ID
  async findByMilestoneId(milestoneId: string) {
    return this.prisma.milestoneSubmission.findFirst({
      where: { milestoneId },
      include: {
        submitter: true,
        reviewer: true,
        requestedByUser: true,
      },
    });
  }

  // Get submissions by submitter ID
  async findBySubmitterId(submitterId: string) {
    return this.prisma.milestoneSubmission.findMany({
      where: { submitterId },
      include: {
        milestone: true,
        reviewer: true,
        requestedByUser: true,
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  // Approve a submission
  async approveSubmission(
    id: string,
    reviewerId: string,
    feedback?: string,
  ) {
    const submission = await this.findOne(id);
    return this.prisma.milestoneSubmission.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewerId,
        reviewedAt: new Date(),
        feedback,
      },
    });
  }

  // Reject a submission
  async rejectSubmission(
    id: string,
    reviewerId: string,
    feedback?: string,
  ) {
    const submission = await this.findOne(id);
    return this.prisma.milestoneSubmission.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewerId,
        reviewedAt: new Date(),
        feedback,
      },
    });
  }

  // Request revisions
  async requestRevisions(
    id: string,
    requestedBy: string,
    feedback: string,
    revisionDueDate: Date,
  ) {
    const submission = await this.findOne(id);
    return this.prisma.milestoneSubmission.update({
      where: { id },
      data: {
        status: 'REJECTED', // Or maybe a separate status for revision requested? We'll use REJECTED for now and have a separate field for revision requested.
        reviewerId: requestedBy, // The one requesting revisions is acting as reviewer
        reviewedAt: new Date(),
        feedback,
        revisionRequestedAt: new Date(),
        requestedBy,
        revisionDueDate,
      },
    });
  }
}
