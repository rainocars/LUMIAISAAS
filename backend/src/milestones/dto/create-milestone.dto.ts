import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsInt, Min, IsNotEmpty, IsISO8601 } from 'class-validator';

export class CreateMilestoneDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsNotEmpty()
  @IsString()
  projectId: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsString()
  approverId?: string;

  @IsOptional()
  @IsISO8601()
  submittedAt?: string;

  @IsOptional()
  @IsString()
  submitterId?: string;

  @IsOptional()
  @IsString()
  reviewedBy?: string;

  @IsOptional()
  @IsISO8601()
  reviewedAt?: string;

  @IsOptional()
  @IsISO8601()
  sentToClientAt?: string;

  @IsOptional()
  @IsISO8601()
  clientApprovedAt?: string;

  @IsOptional()
  @IsString()
  clientFeedback?: string;
}

export class UpdateMilestoneDto extends PartialType(CreateMilestoneDto) {}
