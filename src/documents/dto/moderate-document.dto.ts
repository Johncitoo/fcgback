import { IsEnum, IsOptional, IsString } from 'class-validator';

// Mantén estos valores sincronizados con ValidationStatus y con el enum de BD
export enum ModerateStatus {
  VALID = 'VALID',
  INVALID = 'INVALID',
}

export class ModerateDocumentDto {
  @IsEnum(ModerateStatus)
  status!: ModerateStatus;

  @IsOptional()
  @IsString()
  reason?: string | null;
}
