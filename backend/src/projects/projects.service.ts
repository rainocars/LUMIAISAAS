import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.project.findMany();
  }

  findOne(id: string) {
    return this.prisma.project.findUnique({ where: { id } });
  }

  create(createProjectDto: any) {
    return this.prisma.project.create({ data: createProjectDto });
  }

  update(id: string, updateProjectDto: any) {
    return this.prisma.project.update({ where: { id }, data: updateProjectDto });
  }

  remove(id: string) {
    return this.prisma.project.delete({ where: { id } });
  }
}