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
import { SowsService } from './sows.service';
import { CreateSowDto } from './dto/create-sow.dto';
import { UpdateSowDto } from './dto/update-sow.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../users/user.entity';
import { ParseUUIDPipe } from '@nestjs/core';

@Controller('sows')
export class SowsController {
  constructor(private readonly sowsService: SowsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  create(@Body() createSowDto: CreateSowDto) {
    return this.sowsService.create(createSowDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll() {
    return this.sowsService.findAll();
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sowsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSowDto: UpdateSowDto,
  ) {
    return this.sowsService.update(id, updateSowDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.sowsService.remove(id);
  }

  // Additional endpoint to get SOW by projectId
  @Get('project/:projectId')
  @UseGuards(AuthGuard('jwt'))
  findByProjectId(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.sowsService.findByProjectId(projectId);
  }
}
