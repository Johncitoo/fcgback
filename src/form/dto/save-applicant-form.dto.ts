// backend/src/form/dto/save-applicant-form.dto.ts
import { IsArray, IsString, ValidateNested, Allow } from 'class-validator';
import { Type } from 'class-transformer';

export class SaveApplicantResponseDto {
  @IsString()
  fieldId: string;

  // value puede ser string, número, objeto, etc.
  // no le ponemos validación estricta todavía
  @Allow()
  value: any;
}

export class SaveApplicantFormDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveApplicantResponseDto)
  responses?: Record<string, any>;

  documents?: Array<{
    fieldId: string;
    fileId: string;
  }>;
}
