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
  answers?: any; // Datos del formulario (form_data en BD)

  @IsOptional()
  @IsObject()
  responses?: any; // Alias de answers (compatibilidad)

  @IsOptional()
  @IsString()
  status?: string;
}
