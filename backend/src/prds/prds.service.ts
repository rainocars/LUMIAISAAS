import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreatePrdDto, UpdatePrdDto } from './dto/create-prd.dto';

@Injectable()
export class PrdsService {
  constructor(private prisma: PrismaService) {}

  async create(createPrdDto: CreatePrdDto) {
    return this.prisma.prd.create({
      data: {
        ...createPrdDto,
        // Ensure version defaults to 1 if not provided
        version: createPrdDto.version ?? 1,
        // Ensure status defaults to 'DRAFT' if not provided
        status: createPrdDto.status ?? 'DRAFT',
      },
    });
  }

  async findAll() {
    return this.prisma.prd.findMany({
      where: { deletedAt: null },
      include: {
        project: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const prd = await this.prisma.prd.findUnique({
      where: { id, deletedAt: null },
      include: {
        project: true,
      },
    });

    if (!prd) {
      throw new NotFoundException(`PRD with ID ${id} not found`);
    }
    return prd;
  }

  async update(id: string, updatePrdDto: UpdatePrdDto) {
    const existingPrd = await this.findOne(id);
    return this.prisma.prd.update({
      where: { id },
      data: updatePrdDto,
    });
  }

  async remove(id: string) {
    const existingPrd = await this.findOne(id);
    // Soft delete
    return this.prisma.prd.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // Helper method to get PRD by projectId
  async findByProjectId(projectId: string) {
    return this.prisma.prd.findFirst({
      where: { projectId, deletedAt: null },
    });
  }
}
