import { IsNotEmpty, IsString, IsEmail } from 'class-validator';

export class ValidateInviteDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ValidateInviteResponseDto {
  inviteId: string;
  callId: string;
  institutionId: string | null;
  meta: any;
}
