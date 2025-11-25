import { IsString, Length } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/password-strength.validator';

export class SetPasswordDto {
  @IsString()
  @Length(16, 512)
  token: string;

  @IsString()
  @Length(8, 200)
  @IsStrongPassword()
  password: string;
}
