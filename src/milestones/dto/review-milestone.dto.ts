import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ReviewMilestoneDto {
  @IsEnum(['APPROVED', 'REJECTED'])
  reviewStatus!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNotes?: string;

  @IsUUID()
  reviewedBy!: string;
}
