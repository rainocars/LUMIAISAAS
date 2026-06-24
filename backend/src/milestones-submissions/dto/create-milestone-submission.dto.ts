import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsNotEmpty, IsUrl, IsArray, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMilestoneSubmissionDto {
  @IsNotEmpty()
  @IsString()
  milestoneId: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsNotEmpty()
  @IsString()
  deliverableDescription: string;

  @IsOptional()
  @IsUrl()
  demoVideoUrl?: string;

  @IsOptional()
  @IsUrl()
  stagingUrl?: string;

  @IsOptional()
  @IsUrl()
  githubPrUrl?: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  screenshots?: string[];

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  attachments?: string[];

  @IsNotEmpty()
  @IsString()
  submitterId: string; // Developer user ID
}

export class UpdateMilestoneSubmissionDto extends PartialType(CreateMilestoneSubmissionDto) {
  @IsOptional()
  @IsString()
  feedback?: string;

  @IsOptional()
  @IsString()
  status?: string; // e.g., APPROVED, REJECTED

  @IsOptional()
  @IsString()
  reviewerId?: string; // Admin user ID

  @IsOptional()
  @IsString()
  requestedBy?: string; // Admin user ID requesting revisions

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  revisionDueDate?: Date;
}
