import { IsString, IsUUID, IsOptional, IsInt, Min, IsBoolean, IsArray, IsDate, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMilestoneDto {
  @IsUUID()
  callId!: string;

  @IsOptional()
  @IsUUID()
  formId?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsInt()
  @Min(1)
  orderIndex!: number;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  whoCanFill?: string[];

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date;
}
