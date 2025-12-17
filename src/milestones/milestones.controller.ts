import { Controller, Get, Post, Patch, Delete, Body, Param, Req } from '@nestjs/common';
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

  /**
   * Crea un nuevo hito para una convocatoria.
   * 
   * @param data - DTO con datos del hito (name, callId, orderIndex, etc.)
   * @returns Hito creado
   * 
   * @example
   * POST /api/milestones
   * Body: { "name": "Postulación Inicial", "callId": "uuid", "orderIndex": 1 }
   */
  @Post()
  create(@Body() data: CreateMilestoneDto) {
    return this.milestonesService.create(data);
  }

  /**
   * Obtiene todos los hitos de una convocatoria.
   * Ordenados por orderIndex ascendente.
   * 
   * @param callId - ID de la convocatoria
   * @returns Lista de hitos ordenados
   * 
   * @example
   * GET /api/milestones/call/uuid-123
   */
  @Get('call/:callId')
  findByCall(@Param('callId') callId: string) {
    return this.milestonesService.findByCall(callId);
  }

  /**
   * Obtiene un hito específico por su ID.
   * 
   * @param id - ID del hito
   * @returns Hito encontrado
   * 
   * @example
   * GET /api/milestones/uuid-123
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.milestonesService.findOne(id);
  }

  /**
   * Actualiza parcialmente un hito existente.
   * 
   * @param id - ID del hito
   * @param data - Campos a actualizar
   * @returns Hito actualizado
   * 
   * @example
   * PATCH /api/milestones/uuid-123
   * Body: { "name": "Postulación Final" }
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateMilestoneDto) {
    return this.milestonesService.update(id, data);
  }

  /**
   * Elimina un hito por su ID.
   * 
   * @param id - ID del hito
   * @returns Confirmación de eliminación
   * 
   * @example
   * DELETE /api/milestones/uuid-123
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.milestonesService.remove(id);
  }

  /**
   * Obtiene el progreso de todos los hitos de una aplicación.
   * 
   * @param applicationId - ID de la aplicación
   * @returns Lista de milestone_progress con estado de cada hito
   * 
   * @example
   * GET /api/milestones/progress/uuid-app-123
   */
  @Get('progress/:applicationId')
  @Roles('ADMIN', 'REVIEWER', 'APPLICANT')
  getProgress(@Param('applicationId') applicationId: string) {
    return this.milestonesService.getProgress(applicationId);
  }

  /**
   * Inicializa el progreso de hitos para una aplicación.
   * Crea registros en milestone_progress para cada hito de la convocatoria.
   * 
   * @param data - DTO con applicationId y callId
   * @returns Confirmación de inicialización
   * 
   * @example
   * POST /api/milestones/progress/initialize
   * Body: { "applicationId": "uuid-app", "callId": "uuid-call" }
   */
  @Post('progress/initialize')
  initializeProgress(@Body() data: InitializeProgressDto) {
    return this.milestonesService.initializeProgress(data.applicationId, data.callId);
  }

  /**
   * Revisa, aprueba o rechaza el progreso de un hito.
   * Actualiza el reviewStatus del milestone_progress.
   * 
   * @param progressId - ID del milestone_progress
   * @param data - Estado de revisión (APPROVED, REJECTED, NEEDS_CHANGES) y notas
   * @returns Milestone_progress actualizado
   * 
   * @example
   * PATCH /api/milestones/progress/uuid-progress-123/review
   * Body: { "reviewStatus": "APPROVED", "reviewedBy": "uuid-admin", "reviewNotes": "Aprobado" }
   */
  @Patch('progress/:progressId/review')
  reviewMilestone(
    @Param('progressId') progressId: string,
    @Req() req: any,
    @Body() data: ReviewMilestoneDto,
  ) {
    // Usar el usuario autenticado del JWT en lugar del reviewedBy del body
    const reviewedBy = req.user.sub;
    return this.milestonesService.reviewMilestone(
      progressId,
      data.reviewStatus,
      reviewedBy,
      data.reviewNotes
    );
  }

  /**
   * Obtiene las respuestas del formulario asociado a un hito.
   * Retorna la form_submission del milestone_progress.
   * 
   * @param progressId - ID del milestone_progress
   * @returns Form_submission con respuestas del formulario
   * 
   * @example
   * GET /api/milestones/progress/uuid-progress-123/submission
   */
  @Get('progress/:progressId/submission')
  @Roles('ADMIN', 'REVIEWER', 'APPLICANT')
  getMilestoneSubmission(@Param('progressId') progressId: string) {
    return this.milestonesService.getMilestoneSubmission(progressId);
  }

  /**
   * Sincroniza el progreso de hitos para todas las aplicaciones de una convocatoria.
   * Útil cuando se crean hitos nuevos después de que ya hay postulantes.
   * Crea milestone_progress faltantes para cada aplicación.
   * 
   * @param callId - ID de la convocatoria
   * @returns Confirmación de sincronización con cantidad de registros creados
   * 
   * @example
   * POST /api/milestones/sync-progress/uuid-call-123
   */
  @Post('sync-progress/:callId')
  syncProgressForCall(@Param('callId') callId: string) {
    return this.milestonesService.syncProgressForCall(callId);
  }
}
