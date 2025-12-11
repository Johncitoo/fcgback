import { IsString, IsOptional, IsBoolean, IsObject, IsArray, MinLength, MaxLength } from 'class-validator';

export class CreateFormDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isTemplate?: boolean;

  @IsOptional()
  @IsObject()
  schema?: any;

  @IsOptional()
  @IsArray()
  sections?: any[];
}
