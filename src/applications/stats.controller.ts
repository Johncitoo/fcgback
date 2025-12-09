import { Controller, Get, Param } from '@nestjs/common';
import { ApplicationsService } from './applications.service';

@Controller('admin/stats')
export class StatsController {
  constructor(private apps: ApplicationsService) {}

  @Get(':callId/overview')
  async getOverview(@Param('callId') callId: string) {
    return this.apps.getStatsOverview(callId);
  }

  @Get(':callId/gender-distribution')
  async getGenderDistribution(@Param('callId') callId: string) {
    return this.apps.getGenderDistribution(callId);
  }

  @Get(':callId/top-institutions')
  async getTopInstitutions(@Param('callId') callId: string) {
    return this.apps.getTopInstitutions(callId);
  }

  @Get(':callId/top-communes')
  async getTopCommunes(@Param('callId') callId: string) {
    return this.apps.getTopCommunes(callId);
  }

  @Get(':callId/score-distribution')
  async getScoreDistribution(@Param('callId') callId: string) {
    return this.apps.getScoreDistribution(callId);
  }

  @Get(':callId/submission-timeline')
  async getSubmissionTimeline(@Param('callId') callId: string) {
    return this.apps.getSubmissionTimeline(callId);
  }
}
