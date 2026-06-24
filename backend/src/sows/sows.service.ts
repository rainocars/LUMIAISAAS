import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateSowDto, UpdateSowDto } from './dto/create-sow.dto';

@Injectable()
export class SowsService {
  constructor(private prisma: PrismaService) {}

  async create(createSowDto: CreateSowDto) {
    return this.prisma.sow.create({
      data: {
        ...createSowDto,
      },
    });
  }

  async findAll() {
    return this.prisma.sow.findMany({
      where: { deletedAt: null },
      include: {
        project: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const sow = await this.prisma.sow.findUnique({
      where: { id, deletedAt: null },
      include: {
        project: true,
      },
    });

    if (!sow) {
      throw new NotFoundException(`SOW with ID ${id} not found`);
    }
    return sow;
  }

  async update(id: string, updateSowDto: UpdateSowDto) {
    const existingSow = await this.findOne(id);
    return this.prisma.sow.update({
      where: { id },
      data: updateSowDto,
    });
  }

  async remove(id: string) {
    const existingSow = await this.findOne(id);
    // Soft delete
    return this.prisma.sow.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // Helper method to get SOW by projectId
  async findByProjectId(projectId: string) {
    return this.prisma.sow.findFirst({
      where: { projectId, deletedAt: null },
    });
  }
}
