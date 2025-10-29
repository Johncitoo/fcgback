import { IsEmail, IsString, Length } from 'class-validator';

export class LoginApplicantDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(8, 200)
  password: string;
}
