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
import { MilestonesService } from './milestones.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../users/user.entity';
import { ParseUUIDPipe } from '@nestjs/core';

@Controller('milestones')
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.DEVELOPER) // Who can create milestones? Probably admins or project managers.
  create(@Body() createMilestoneDto: CreateMilestoneDto) {
    return this.milestonesService.create(createMilestoneDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll() {
    return this.milestonesService.findAll();
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.milestonesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.DEVELOPER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMilestoneDto: UpdateMilestoneDto,
  ) {
    return this.milestonesService.update(id, updateMilestoneDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.milestonesService.remove(id);
  }

  // Get milestones by project ID
  @Get('project/:projectId')
  @UseGuards(AuthGuard('jwt'))
  findByProjectId(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.milestonesService.findByProjectId(projectId);
  }

  // Update milestone status (for workflow)
  @Patch(':id/status')
  @UseGuards(AuthGuard('jwt'))
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: string,
  ) {
    return this.milestonesService.updateStatus(id, status);
  }
}
