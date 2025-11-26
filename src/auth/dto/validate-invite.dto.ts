import { IsNotEmpty, IsString, IsEmail, IsOptional } from 'class-validator';

export class ValidateInviteDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional() // DEBE IR PRIMERO - Email es opcional
  @IsEmail() // Solo valida si el email está presente
  email?: string;
}

export class ValidateInviteResponseDto {
  inviteId: string;
  callId: string;
  institutionId: string | null;
  meta: any;
}
