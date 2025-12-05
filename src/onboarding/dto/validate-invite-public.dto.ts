import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class ValidateInvitePublicDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  code: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}
