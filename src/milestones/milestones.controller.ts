import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { MilestonesService } from './milestones.service';
import { Roles } from '../auth/roles.decorator';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { InitializeProgressDto } from './dto/initialize-progress.dto';
import { ReviewMilestoneDto } from './dto/review-milestone.dto';

@Controller('milestones')
@Roles('ADMIN', 'REVIEWER')
export class MilestonesController {
  constructor(private milestonesService: MilestonesService) {}

  @Post()
  create(@Body() data: CreateMilestoneDto) {
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
  update(@Param('id') id: string, @Body() data: UpdateMilestoneDto) {
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
  initializeProgress(@Body() data: InitializeProgressDto) {
    return this.milestonesService.initializeProgress(data.applicationId, data.callId);
  }

  // Endpoint para revisar/aprobar/rechazar un hito
  @Patch('progress/:progressId/review')
  reviewMilestone(
    @Param('progressId') progressId: string,
    @Body() data: ReviewMilestoneDto
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

  // Endpoint para sincronizar milestone_progress de una convocatoria
  // Útil cuando se crean hitos nuevos después de que ya hay postulantes
  @Post('sync-progress/:callId')
  syncProgressForCall(@Param('callId') callId: string) {
    return this.milestonesService.syncProgressForCall(callId);
  }
}
