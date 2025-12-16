import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { FormSubmissionsService } from './form-submissions.service';
import { Roles } from '../auth/roles.decorator';
import { CreateFormSubmissionDto } from './dto/create-form-submission.dto';
import { UpdateFormSubmissionDto } from './dto/update-form-submission.dto';
import { SubmitFormDto } from './dto/submit-form.dto';

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
  create(@Body() data: CreateFormSubmissionDto) {
    return this.submissionsService.create(data);
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
  remove(@Param('id') id: string) {
    return this.submissionsService.softDelete(id);
  }
}
