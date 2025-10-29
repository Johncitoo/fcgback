import { IsString, Length } from 'class-validator';

export class SetPasswordDto {
  @IsString()
  @Length(16, 512)
  token: string;

  @IsString()
  @Length(8, 200)
  password: string;
}
