import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DevCreateInviteDto {
  @IsUUID()
  callId: string;

  @IsString()
  @Length(4, 128)
  code: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  ttlDays?: number;

  @IsOptional()
  @IsUUID()
  institutionId?: string;
}
