import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { ApplicantsController } from './applicants.controller';
import { ApplicantsStatsController } from './applicants-stats.controller';
import { ApplicantsStatsService } from './applicants.service';

@Module({
  imports: [JwtModule, ConfigModule],
  controllers: [ApplicantsController, ApplicantsStatsController],
  providers: [ApplicantsStatsService],
  exports: [ApplicantsStatsService],
})
export class ApplicantsModule {}
