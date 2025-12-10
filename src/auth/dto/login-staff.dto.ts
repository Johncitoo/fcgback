import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginStaffDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8) // Login solo requiere mínimo, no validación fuerte
  password!: string;
}
