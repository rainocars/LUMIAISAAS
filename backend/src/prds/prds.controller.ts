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
import { PrdsService } from './prds.service';
import { CreatePrdDto } from './dto/create-prd.dto';
import { UpdatePrdDto } from './dto/update-prd.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../users/user.entity';
import { ParseUUIDPipe } from '@nestjs/core';

@Controller('prds')
export class PrdsController {
  constructor(private readonly prdsService: PrdsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  create(@Body() createPrdDto: CreatePrdDto) {
    return this.prdsService.create(createPrdDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll() {
    return this.prdsService.findAll();
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.prdsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePrdDto: UpdatePrdDto,
  ) {
    return this.prdsService.update(id, updatePrdDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.prdsService.remove(id);
  }

  // Additional endpoint to get PRD by projectId
  @Get('project/:projectId')
  @UseGuards(AuthGuard('jwt'))
  findByProjectId(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.prdsService.findByProjectId(projectId);
  }
}
