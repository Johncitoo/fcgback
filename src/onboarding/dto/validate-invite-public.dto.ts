import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ValidateInvitePublicDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  code: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;
}
