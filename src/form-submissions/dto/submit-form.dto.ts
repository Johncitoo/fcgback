import { IsUUID } from 'class-validator';

export class SubmitFormDto {
  @IsUUID()
  userId!: string;
}
