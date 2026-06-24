import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateMilestoneDto, UpdateMilestoneDto } from './dto/create-milestone.dto';

@Injectable()
export class MilestonesService {
  constructor(private prisma: PrismaService) {}

  async create(createMilestoneDto: CreateMilestoneDto) {
    return this.prisma.milestone.create({
      data: {
        ...createMilestoneDto,
        // Convert string dates to Date objects if provided
        dueDate: createMilestoneDto.dueDate ? new Date(createMilestoneDto.dueDate) : undefined,
        submittedAt: createMilestoneDto.submittedAt ? new Date(createMilestoneDto.submittedAt) : undefined,
        reviewedAt: createMilestoneDto.reviewedAt ? new Date(createMilestoneDto.reviewedAt) : undefined,
        sentToClientAt: createMilestoneDto.sentToClientAt ? new Date(createMilestoneDto.sentToClientAt) : undefined,
        clientApprovedAt: createMilestoneDto.clientApprovedAt ? new Date(createMilestoneDto.clientApprovedAt) : undefined,
      },
    });
  }

  async findAll() {
    return this.prisma.milestone.findMany({
      where: { deletedAt: null },
      include: {
        project: true,
        submission: true,
        approver: true,
        submitter: true,
        reviewer: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id, deletedAt: null },
      include: {
        project: true,
        submission: true,
        approver: true,
        submitter: true,
        reviewer: true,
      },
    });

    if (!milestone) {
      throw new NotFoundException(`Milestone with ID ${id} not found`);
    }
    return milestone;
  }

  async update(id: string, updateMilestoneDto: UpdateMilestoneDto) {
    const existingMilestone = await this.findOne(id);
    return this.prisma.milestone.update({
      where: { id },
      data: {
        ...updateMilestoneDto,
        // Convert string dates to Date objects if provided
        dueDate: updateMilestoneDto.dueDate ? new Date(updateMilestoneDto.dueDate) : undefined,
        submittedAt: updateMilestoneDto.submittedAt ? new Date(updateMilestoneDto.submittedAt) : undefined,
        reviewedAt: updateMilestoneDto.reviewedAt ? new Date(updateMilestoneDto.reviewedAt) : undefined,
        sentToClientAt: updateMilestoneDto.sentToClientAt ? new Date(updateMilestoneDto.sentToClientAt) : undefined,
        clientApprovedAt: updateMilestoneDto.clientApprovedAt ? new Date(updateMilestoneDto.clientApprovedAt) : undefined,
      },
    });
  }

  async remove(id: string) {
    const existingMilestone = await this.findOne(id);
    // Soft delete
    return this.prisma.milestone.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // Helper method to get milestones by projectId
  async findByProjectId(projectId: string) {
    return this.prisma.milestone.findMany({
      where: { projectId, deletedAt: null },
      include: {
        submission: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Method to update milestone status (used in workflow)
  async updateStatus(id: string, status: string) {
    return this.prisma.milestone.update({
      where: { id },
      data: { status },
    });
  }
}
