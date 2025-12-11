import { IsOptional, IsNumberString, IsEnum } from 'class-validator';

export class ListCallsDto {
  @IsOptional()
  @IsNumberString()
  limit?: string;

  @IsOptional()
  @IsNumberString()
  offset?: string;

  @IsOptional()
  @IsEnum(['true', 'false', '0', '1'])
  onlyActive?: string;

  @IsOptional()
  @IsEnum(['true', 'false', '0', '1'])
  count?: string;
}
