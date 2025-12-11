import { IsUUID, IsOptional, IsObject, IsString } from 'class-validator';

export class CreateFormSubmissionDto {
  @IsUUID()
  applicationId!: string;

  @IsUUID()
  milestoneId!: string;

  @IsOptional()
  @IsUUID()
  formId?: string;

  @IsOptional()
  @IsObject()
  responses?: any;

  @IsOptional()
  @IsString()
  status?: string;
}
