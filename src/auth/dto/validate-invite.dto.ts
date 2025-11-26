import { IsNotEmpty, IsString, IsEmail, IsOptional } from 'class-validator';

export class ValidateInviteDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsEmail()
  @IsOptional() // Email es opcional - se puede obtener del invite
  email?: string;
}

export class ValidateInviteResponseDto {
  inviteId: string;
  callId: string;
  institutionId: string | null;
  meta: any;
}
