import { IsObject } from 'class-validator';

export class SaveAnswersDto {
  @IsObject()
  answers!: any;
}
