import { IsEmail, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class IssuePasswordLinkDto {
  @IsUUID()
  callId: string;

  @IsString()
  @Length(4, 128)
  code: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @Length(2, 200)
  fullName?: string;
}
