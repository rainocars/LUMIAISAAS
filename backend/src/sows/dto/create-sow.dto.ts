import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsObject, IsNotEmpty, IsNumber, IsPositive, IsInt } from 'class-validator';

export class CreateSowDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  timeline?: Record<string, any>; // e.g., { startDate: string, endDate: string, duration: number }

  @IsOptional()
  @IsObject()
  deliverables?: any[]; // Array of { description: string, dueDate: string }

  @IsOptional()
  @IsObject()
  milestones?: any[]; // Array of milestone objects

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  pricing?: number;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  // projectId is optional because it might be set later or via relation
  @IsOptional()
  @IsString()
  projectId?: string;

  // createdBy is the user ID of the creator
  @IsNotEmpty()
  @IsString()
  createdBy: string;
}

export class UpdateSowDto extends PartialType(CreateSowDto) {}
