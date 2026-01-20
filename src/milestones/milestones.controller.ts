import { Controller, Get, Post, Patch, Delete, Body, Param, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { MilestonesService } from './milestones.service';
import { Roles } from '../auth/roles.decorator';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { InitializeProgressDto } from './dto/initialize-progress.dto';
import { ReviewMilestoneDto } from './dto/review-milestone.dto';

/**
 * Controlador para gestión de hitos (milestones) del proceso de becas.
 * 
 * Los hitos representan pasos del proceso que el postulante debe completar,
 * como: Postulación Inicial, Documentos, Entrevista, etc.
 * 
 * Funcionalidades:
 * - CRUD de hitos por convocatoria
 * - Inicialización de progreso por postulante
 * - Revisión y aprobación de hitos
 * 
 * @path /milestones
 * @roles ADMIN, REVIEWER
 */
@ApiTags('Milestones')
@ApiBearerAuth('JWT-auth')
@Controller('milestones')
@Roles('ADMIN', 'REVIEWER')
export class MilestonesController {
  constructor(
    private milestonesService: MilestonesService,
  ) {}

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
  @ApiOperation({ summary: 'Crear hito', description: 'Crea un nuevo hito para una convocatoria' })
  @ApiResponse({ status: 201, description: 'Hito creado' })
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
  @ApiOperation({ summary: 'Listar hitos por convocatoria', description: 'Obtiene todos los hitos de una convocatoria ordenados' })
  @ApiParam({ name: 'callId', description: 'ID de la convocatoria' })
  @ApiResponse({ status: 200, description: 'Lista de hitos ordenados' })
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
  @ApiOperation({ summary: 'Obtener hito', description: 'Obtiene un hito específico por ID' })
  @ApiParam({ name: 'id', description: 'ID del hito' })
  @ApiResponse({ status: 200, description: 'Hito encontrado' })
  @ApiResponse({ status: 404, description: 'Hito no encontrado' })
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
  @ApiOperation({ summary: 'Actualizar hito', description: 'Actualiza parcialmente un hito existente' })
  @ApiParam({ name: 'id', description: 'ID del hito' })
  @ApiResponse({ status: 200, description: 'Hito actualizado' })
  @ApiResponse({ status: 404, description: 'Hito no encontrado' })
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
  @ApiOperation({ summary: 'Eliminar hito', description: 'Elimina un hito por su ID' })
  @ApiParam({ name: 'id', description: 'ID del hito' })
  @ApiResponse({ status: 200, description: 'Hito eliminado' })
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
  @ApiOperation({ summary: 'Obtener progreso', description: 'Obtiene el progreso de todos los hitos de una aplicación' })
  @ApiParam({ name: 'applicationId', description: 'ID de la aplicación' })
  @ApiResponse({ status: 200, description: 'Lista de progreso de hitos' })
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
  @ApiOperation({ summary: 'Inicializar progreso', description: 'Crea registros de progreso para cada hito de la convocatoria' })
  @ApiResponse({ status: 201, description: 'Progreso inicializado' })
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
  @ApiOperation({ summary: 'Revisar hito', description: 'Aprueba, rechaza o solicita cambios en un hito' })
  @ApiParam({ name: 'progressId', description: 'ID del milestone_progress' })
  @ApiResponse({ status: 200, description: 'Hito revisado' })
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
  @ApiOperation({ summary: 'Obtener respuestas de hito', description: 'Retorna las respuestas del formulario del hito' })
  @ApiParam({ name: 'progressId', description: 'ID del milestone_progress' })
  @ApiResponse({ status: 200, description: 'Respuestas del formulario' })
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
