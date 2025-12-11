import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateEmailTemplateDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  key!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  subjectTemplate!: string;

  @IsString()
  @MinLength(10)
  bodyTemplate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
