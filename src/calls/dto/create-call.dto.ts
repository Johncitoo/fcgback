import { IsString, IsOptional, IsInt, IsDateString, IsEnum, IsUUID, MinLength, MaxLength, Min } from 'class-validator';

export class CreateCallDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name!: string;

  @IsInt()
  @Min(2000)
  year!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsDateString()
  openDate?: string;

  @IsOptional()
  @IsDateString()
  closeDate?: string;

  @IsOptional()
  @IsEnum(['DRAFT', 'OPEN', 'CLOSED', 'EVALUATING', 'COMPLETED'])
  status?: 'DRAFT' | 'OPEN' | 'CLOSED' | 'EVALUATING' | 'COMPLETED';

  @IsOptional()
  @IsUUID()
  formId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxApplications?: number;
}
