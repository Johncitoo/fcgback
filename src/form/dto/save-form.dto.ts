import { IsArray, IsNotEmpty, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class FormFieldDto {
  @IsNotEmpty()
  label: string;

  @IsNotEmpty()
  type: string;

  @IsOptional()
  name?: string;

  @IsOptional()
  placeholder?: string;

  @IsOptional()
  hint?: string;

  @IsOptional()
  helpText?: string;

  @IsOptional()
  required?: boolean;

  @IsOptional()
  options?: any;

  @IsOptional()
  show_if?: any;

  @IsOptional()
  showIf?: any;

  @IsOptional()
  validation?: any;

  @IsOptional()
  order?: number;

  @IsOptional()
  active?: boolean;

  @IsOptional()
  visibility?: string;

  @IsOptional()
  editableByRoles?: string[];
}

class FormSectionDto {
  @IsNotEmpty()
  title: string;

  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields: FormFieldDto[];

  order?: number;
}

export class SaveFormDto {
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => FormSectionDto)
  sections: FormSectionDto[];
}
