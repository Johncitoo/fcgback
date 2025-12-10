import { IsString, Length } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/strong-password.validator';

export class SetPasswordDto {
  @IsString()
  @Length(16, 512)
  token: string;

  @IsString()
  @Length(12, 200) // Mínimo 12 caracteres
  @IsStrongPassword()
  password: string;
}
