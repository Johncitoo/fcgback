import { IsString, IsOptional, IsInt, IsDateString, IsEnum, IsUUID, IsBoolean, MinLength, MaxLength, Min } from 'class-validator';

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
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(['DRAFT', 'OPEN', 'CLOSED'])
  status?: 'DRAFT' | 'OPEN' | 'CLOSED';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  formId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxApplications?: number;
}
