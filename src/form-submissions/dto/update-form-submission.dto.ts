import { PartialType } from '@nestjs/mapped-types';
import { CreateFormSubmissionDto } from './create-form-submission.dto';

export class UpdateFormSubmissionDto extends PartialType(CreateFormSubmissionDto) {}
