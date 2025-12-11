import { IsObject, IsOptional } from 'class-validator';

export class UpdateApplicationDto {
  @IsOptional()
  @IsObject()
  academic?: any;

  @IsOptional()
  @IsObject()
  household?: any;

  @IsOptional()
  @IsObject()
  participation?: any;

  @IsOptional()
  @IsObject()
  texts?: any;

  @IsOptional()
  @IsObject()
  builderExtra?: any;
}
