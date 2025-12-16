import { Controller, Get, Param, Patch, Body } from '@nestjs/common';
import { FormService } from './form.service';
import { SaveApplicantFormDto } from './dto/save-applicant-form.dto';
import { Roles } from '../auth/roles.decorator';

/**
 * Controlador para acceso de postulantes a formularios.
 * 
 * Proporciona endpoints para:
 * - Obtener formulario de una convocatoria
 * - Obtener formulario activo del postulante
 * - Guardar borrador de formulario de application
 * 
 * Rutas bajo /calls para mantener compatibilidad con frontend.
 * 
 * Seguridad: Solo APPLICANT
 */
@Controller('calls')
@Roles('APPLICANT')
export class FormController {
  constructor(private form: FormService) {}

  /**
   * GET /api/calls/:callId/form
   * 
   * Obtiene el formulario asociado a una convocatoria.
   * 
   * @param callId - UUID de la convocatoria
   * @returns Formulario con schema de secciones y campos
   */
  @Get(':callId/form')
  async getForm(@Param('callId') callId: string) {
    return this.form.getForm(callId);
  }

  /**
   * GET /api/calls/applicant/:applicantId/form/active
   * 
   * Obtiene el formulario activo del postulante.
   * Busca la application activa y retorna su formulario.
   * 
   * @param applicantId - UUID del postulante
   * @returns Formulario activo o null
   */
  @Get('applicant/:applicantId/form/active')
  async getActiveApplicantForm(@Param('applicantId') applicantId: string) {
    return this.form.getActiveApplicantForm(applicantId);
  }

  /**
   * PATCH /api/calls/applicant/application/:applicationId/save
   * 
   * Guarda borrador del formulario de una application.
   * No marca como enviado, solo persiste datos intermedios.
   * 
   * @param applicationId - UUID de la application
   * @param body - DTO con datos del formulario (respuestas por campo)
   * @returns Confirmación de guardado
   */
  @Patch('applicant/application/:applicationId/save')
  async saveApplicantForm(
    @Param('applicationId') applicationId: string,
    @Body() body: SaveApplicantFormDto,
  ) {
    return this.form.saveApplicantForm(applicationId, body);
  }
}

/**
 * Controlador legacy para acceso directo a formularios por ID.
 * Renombrado a /forms-legacy para evitar conflicto con FormsController.
 * 
 * Usado por sistemas heredados que necesitan obtener formularios sin autenticación.
 */
@Controller('forms-legacy')
export class FormsLegacyController {
  constructor(private form: FormService) {}

  /**
   * GET /api/forms-legacy/:formId
   * 
   * Obtiene un formulario por su ID sin validación de roles.
   * 
   * @param formId - UUID del formulario
   * @returns Formulario con schema completo
   */
  @Get(':formId')
  async getFormById(@Param('formId') formId: string) {
    return this.form.getFormById(formId);
  }
}
