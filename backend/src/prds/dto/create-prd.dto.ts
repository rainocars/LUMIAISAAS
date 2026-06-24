import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsInt, Min, IsNotEmpty } from 'class-validator';

export class CreatePrdDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @IsOptional()
  @IsString()
  status?: string;

  // projectId is optional because it might be set later or via relation
  @IsOptional()
  @IsString()
  projectId?: string;

  // createdBy is the user ID of the creator (from Studio or auth)
  @IsNotEmpty()
  @IsString()
  createdBy: string;
}

export class UpdatePrdDto extends PartialType(CreatePrdDto) {}
