import { IsUUID, IsString, Length } from 'class-validator';

export class ValidateInviteDto {
  @IsUUID()
  callId: string;

  @IsString()
  @Length(4, 128)
  code: string;
}
