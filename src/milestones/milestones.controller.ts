import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { MilestonesService } from './milestones.service';

@Controller('milestones')
export class MilestonesController {
  constructor(private milestonesService: MilestonesService) {}

  @Post()
  create(@Body() data: any) {
    return this.milestonesService.create(data);
  }

  @Get('call/:callId')
  findByCall(@Param('callId') callId: string) {
    return this.milestonesService.findByCall(callId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.milestonesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.milestonesService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.milestonesService.remove(id);
  }

  @Get('progress/:applicationId')
  getProgress(@Param('applicationId') applicationId: string) {
    return this.milestonesService.getProgress(applicationId);
  }

  @Post('progress/initialize')
  initializeProgress(@Body() data: { applicationId: string; callId: string }) {
    return this.milestonesService.initializeProgress(data.applicationId, data.callId);
  }

  // Endpoint para revisar/aprobar/rechazar un hito
  @Patch('progress/:progressId/review')
  reviewMilestone(
    @Param('progressId') progressId: string,
    @Body() data: { 
      reviewStatus: 'APPROVED' | 'REJECTED' | 'NEEDS_CHANGES';
      reviewNotes?: string;
      reviewedBy: string;
    }
  ) {
    return this.milestonesService.reviewMilestone(
      progressId,
      data.reviewStatus,
      data.reviewedBy,
      data.reviewNotes
    );
  }

  // Endpoint para obtener las respuestas de un hito
  @Get('progress/:progressId/submission')
  getMilestoneSubmission(@Param('progressId') progressId: string) {
    return this.milestonesService.getMilestoneSubmission(progressId);
  }
}
