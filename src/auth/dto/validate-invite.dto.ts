import { IsNotEmpty, IsString } from 'class-validator';

export class ValidateInviteDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class ValidateInviteResponseDto {
  inviteId: string;
  callId: string;
  institutionId: string | null;
  meta: any;
}
