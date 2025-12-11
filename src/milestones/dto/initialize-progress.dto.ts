import { IsUUID } from 'class-validator';

export class InitializeProgressDto {
  @IsUUID()
  applicationId!: string;

  @IsUUID()
  callId!: string;
}
