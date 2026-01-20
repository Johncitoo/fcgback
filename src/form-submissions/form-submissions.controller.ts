import { Controller, Get, Post, Patch, Delete, Body, Param, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { FormSubmissionsService } from './form-submissions.service';
import { Roles } from '../auth/roles.decorator';
import { CreateFormSubmissionDto } from './dto/create-form-submission.dto';
import { UpdateFormSubmissionDto } from './dto/update-form-submission.dto';
import { SubmitFormDto } from './dto/submit-form.dto';

/**
 * Controller para gestión de submissions de formularios (form_submissions).
 * 
 * Gestiona el ciclo de vida de respuestas de formularios: crear borrador,
 * actualizar respuestas, enviar para revisión y eliminar.
 * 
 * Una form_submission representa:
 * - Las respuestas de un postulante a un formulario específico
 * - Estado: draft (borrador) o submitted (enviado)
 * - Vinculación con application, form y milestone
 * 
 * @path /form-submissions
 * @roles ADMIN, REVIEWER - La mayoría de endpoints requieren staff (salvo overrides específicos)
 */
@ApiTags('Form Submissions')
@ApiBearerAuth('JWT-auth')
@Controller('form-submissions')
@Roles('ADMIN', 'REVIEWER')
export class FormSubmissionsController {
  constructor(private submissionsService: FormSubmissionsService) {}

  /**
   * Crea una nueva submission de formulario.
   * Guarda las respuestas de un formulario como borrador.
   * 
   * @param data - DTO con applicationId, formId, milestoneId y answers
   * @returns Form_submission creada
   * 
   * @example
   * POST /api/form-submissions
   * Body: { "applicationId": "uuid", "formId": "uuid", "answers": { "field1": "value1" } }
   */
  @Post()
  @Roles('ADMIN', 'REVIEWER', 'APPLICANT')
  @ApiOperation({ summary: 'Crear submission', description: 'Crea una nueva respuesta de formulario como borrador' })
  @ApiResponse({ status: 201, description: 'Submission creada' })
  create(@Body() data: CreateFormSubmissionDto, @Req() req: any) {
    const userRole = req.user?.role;
    return this.submissionsService.create(data, userRole);
  }

  /**
   * Obtiene todas las submissions de formulario de una aplicación.
   * 
   * @param applicationId - ID de la aplicación
   * @returns Array de form_submissions
   * 
   * @example
   * GET /api/form-submissions/application/uuid-app-123
   */
  @Get('application/:applicationId')
  @Roles('ADMIN', 'REVIEWER', 'APPLICANT')
  @ApiOperation({ summary: 'Listar por aplicación', description: 'Obtiene todas las submissions de una aplicación' })
  @ApiParam({ name: 'applicationId', description: 'ID de la aplicación' })
  @ApiResponse({ status: 200, description: 'Lista de submissions' })
  findByApplication(@Param('applicationId') applicationId: string) {
    return this.submissionsService.findByApplication(applicationId);
  }

  /**
   * Obtiene todas las submissions de formulario de un hito específico.
   * 
   * @param milestoneId - ID del hito
   * @returns Array de form_submissions
   * 
   * @example
   * GET /api/form-submissions/milestone/uuid-milestone-123
   */
  @Get('milestone/:milestoneId')
  @Roles('ADMIN', 'REVIEWER', 'APPLICANT')
  @ApiOperation({ summary: 'Listar por hito', description: 'Obtiene todas las submissions de un hito' })
  @ApiParam({ name: 'milestoneId', description: 'ID del hito' })
  @ApiResponse({ status: 200, description: 'Lista de submissions' })
  findByMilestone(@Param('milestoneId') milestoneId: string) {
    return this.submissionsService.findByMilestone(milestoneId);
  }

  /**
   * Obtiene una submission de formulario específica por su ID.
   * 
   * @param id - ID de la form_submission
   * @returns Form_submission con respuestas completas
   * 
   * @example
   * GET /api/form-submissions/uuid-123
   */
  @Get(':id')
  @Roles('ADMIN', 'REVIEWER', 'APPLICANT')
  @ApiOperation({ summary: 'Obtener submission', description: 'Obtiene una submission específica por ID' })
  @ApiParam({ name: 'id', description: 'ID de la form_submission' })
  @ApiResponse({ status: 200, description: 'Submission con respuestas' })
  findOne(@Param('id') id: string) {
    return this.submissionsService.findOne(id);
  }

  /**
   * Actualiza las respuestas de una submission de formulario.
   * 
   * @param id - ID de la form_submission
   * @param data - Nuevas respuestas a guardar
   * @returns Form_submission actualizada
   * 
   * @example
   * PATCH /api/form-submissions/uuid-123
   * Body: { "answers": { "field1": "new value" } }
   */
  @Patch(':id')
  @Roles('ADMIN', 'REVIEWER', 'APPLICANT')
  @ApiOperation({ summary: 'Actualizar submission', description: 'Actualiza las respuestas de una submission' })
  @ApiParam({ name: 'id', description: 'ID de la form_submission' })
  @ApiResponse({ status: 200, description: 'Submission actualizada' })
  update(@Param('id') id: string, @Body() data: UpdateFormSubmissionDto) {
    return this.submissionsService.update(id, data);
  }

  /**
   * Envía una submission de formulario para revisión.
   * Marca la submission como submitted y actualiza timestamps.
   * 
   * @param id - ID de la form_submission
   * @param data - DTO con userId del usuario que envía
   * @returns Form_submission enviada
   * 
   * @example
   * POST /api/form-submissions/uuid-123/submit
   * Body: { "userId": "uuid-user" }
   */
  @Post(':id/submit')
  @Roles('ADMIN', 'REVIEWER', 'APPLICANT')
  @ApiOperation({ summary: 'Enviar submission', description: 'Envía la submission para revisión' })
  @ApiParam({ name: 'id', description: 'ID de la form_submission' })
  @ApiResponse({ status: 200, description: 'Submission enviada' })
  submit(@Param('id') id: string, @Body() data: SubmitFormDto) {
    return this.submissionsService.submit(id, data.userId);
  }

  /**
   * Elimina (soft delete) una submission de formulario.
   * Marca como eliminada sin borrar de la base de datos.
   * 
   * @param id - ID de la form_submission
   * @returns Confirmación de eliminación
   * 
   * @example
   * DELETE /api/form-submissions/uuid-123
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar submission', description: 'Elimina (soft delete) una submission' })
  @ApiParam({ name: 'id', description: 'ID de la form_submission' })
  @ApiResponse({ status: 200, description: 'Submission eliminada' })
  remove(@Param('id') id: string) {
    return this.submissionsService.softDelete(id);
  }
}
