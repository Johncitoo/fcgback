import { IsObject, IsOptional } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsObject()
  data?: any;
}
