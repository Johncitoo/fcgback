import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ReviewMilestoneDto {
  @IsEnum(['APPROVED', 'REJECTED', 'NEEDS_CHANGES'])
  reviewStatus!: 'APPROVED' | 'REJECTED' | 'NEEDS_CHANGES';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNotes?: string;

  @IsUUID()
  reviewedBy!: string;
}
