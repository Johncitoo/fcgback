import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Roles } from '../auth/roles.decorator';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { TemplateRendererService } from './template-renderer.service';

/**
 * Controlador para gestión de plantillas de email.
 * 
 * Proporciona CRUD completo para email_templates:
 * - Listar plantillas con paginación
 * - Crear nuevas plantillas
 * - Obtener plantilla por ID con metadata de variables
 * - Actualizar plantillas editables
 * - Preview de plantillas con datos de ejemplo
 * 
 * Seguridad: Solo ADMIN
 */
@Controller('email/templates')
@Roles('ADMIN')
export class EmailTemplatesController {
  constructor(
    private ds: DataSource,
    private templateRenderer: TemplateRendererService,
  ) {}

  /**
   * GET /api/email/templates
   * 
   * Lista plantillas de email con paginación.
   * 
   * @param limit - Cantidad de resultados (default: 20)
   * @param offset - Desplazamiento para paginación (default: 0)
   * @param count - Si es '1' o 'true', incluye total de registros
   * @returns Objeto con data (array de plantillas), total (opcional), limit, offset
   */
  @Get()
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('count') count?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    const needCount = count === '1' || count === 'true';

    const query = `
      SELECT 
        id,
        key,
        name,
        subject_tpl as "subjectTemplate",
        body_tpl as "bodyTemplate",
        created_at as "createdAt"
      FROM email_templates
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const data = await this.ds.query(query, [limitNum, offsetNum]);

    let total: number | undefined;
    if (needCount) {
      const countResult = await this.ds.query(
        `SELECT COUNT(*) as count FROM email_templates`,
      );
      total = parseInt(countResult[0].count, 10);
    }

    return { data, total, limit: limitNum, offset: offsetNum };
  }

  /**
   * POST /api/email/templates
   * 
   * Crea una nueva plantilla de email.
   * 
   * @param body - DTO con key, name, subjectTemplate, bodyTemplate
   * @returns Plantilla creada con id generado
   * @throws BadRequestException si faltan campos requeridos
   */
  @Post()
  async create(@Body() body: CreateEmailTemplateDto) {
    if (!body.key || !body.name || !body.subjectTemplate || !body.bodyTemplate) {
      throw new BadRequestException(
        'key, name, subjectTemplate, and bodyTemplate are required',
      );
    }

    const result = await this.ds.query(
      `
      INSERT INTO email_templates (id, key, name, subject_tpl, body_tpl)
      VALUES (gen_random_uuid(), $1, $2, $3, $4)
      RETURNING id, key, name, subject_tpl as "subjectTemplate", body_tpl as "bodyTemplate", created_at as "createdAt"
      `,
      [body.key, body.name, body.subjectTemplate, body.bodyTemplate],
    );

    return result[0];
  }

  /**
   * GET /api/email/templates/:id
   * 
   * Obtiene una plantilla por ID con metadata de variables disponibles.
   * 
   * @param id - UUID de la plantilla
   * @returns Plantilla con availableVariables (nombre, descripción, required)
   * @throws BadRequestException si no existe
   */
  @Get(':id')
  async getById(@Param('id') id: string) {
    const result = await this.ds.query(
      `
      SELECT 
        id,
        key,
        name,
        COALESCE(text_subject, subject_tpl) as "subjectTemplate",
        COALESCE(text_content, body_tpl) as "bodyTemplate",
        is_editable as "isEditable",
        created_at as "createdAt"
      FROM email_templates
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    if (!result || result.length === 0) {
      throw new BadRequestException('Template not found');
    }

    const template = result[0];
    
    // Agregar metadata de variables disponibles
    template.availableVariables = this.getAvailableVariables(template.key);
    
    return template;
  }

  /**
   * Retorna metadatos de variables disponibles para cada tipo de plantilla.
   * 
   * Plantillas soportadas:
   * - INVITE_APPLICANT: applicant_name, call_name, invite_code, invite_link
   * - PASSWORD_SET: applicant_name, call_name, password_set_link
   * - PASSWORD_RESET: applicant_name, reset_link
   * - FORM_SUBMITTED: applicant_name, call_name, form_name, submission_date, dashboard_link
   * - MILESTONE_APPROVED: applicant_name, call_name, milestone_name, next_milestone_name, dashboard_link
   * - MILESTONE_REJECTED: applicant_name, call_name, milestone_name
   * - WELCOME: applicant_name, dashboard_link
   * 
   * @param templateKey - Clave de la plantilla
   * @returns Array de variables con name, description, required
   */
  private getAvailableVariables(templateKey: string): Array<{name: string, description: string, required: boolean}> {
    const variables: Record<string, Array<{name: string, description: string, required: boolean}>> = {
      INVITE_APPLICANT: [
        { name: 'applicant_name', description: 'Nombre completo del postulante', required: true },
        { name: 'call_name', description: 'Nombre de la convocatoria', required: true },
        { name: 'invite_code', description: 'Código único de invitación', required: true },
        { name: 'invite_link', description: 'Link directo al formulario', required: true },
      ],
      PASSWORD_SET: [
        { name: 'applicant_name', description: 'Nombre completo del postulante', required: true },
        { name: 'call_name', description: 'Nombre de la convocatoria', required: false },
        { name: 'password_set_link', description: 'Link para establecer contraseña', required: true },
      ],
      PASSWORD_RESET: [
        { name: 'applicant_name', description: 'Nombre completo del usuario', required: true },
        { name: 'reset_link', description: 'Link para restablecer contraseña', required: true },
      ],
      FORM_SUBMITTED: [
        { name: 'applicant_name', description: 'Nombre completo del postulante', required: true },
        { name: 'call_name', description: 'Nombre de la convocatoria', required: true },
        { name: 'form_name', description: 'Nombre del formulario enviado', required: true },
        { name: 'submission_date', description: 'Fecha y hora de envío', required: true },
        { name: 'dashboard_link', description: 'Link al dashboard del postulante', required: true },
      ],
      MILESTONE_APPROVED: [
        { name: 'applicant_name', description: 'Nombre completo del postulante', required: true },
        { name: 'call_name', description: 'Nombre de la convocatoria', required: true },
        { name: 'milestone_name', description: 'Nombre del hito aprobado', required: true },
        { name: 'next_milestone_name', description: 'Nombre del siguiente hito', required: false },
        { name: 'dashboard_link', description: 'Link al dashboard del postulante', required: true },
      ],
      MILESTONE_REJECTED: [
        { name: 'applicant_name', description: 'Nombre completo del postulante', required: true },
        { name: 'call_name', description: 'Nombre de la convocatoria', required: true },
        { name: 'milestone_name', description: 'Nombre del hito rechazado', required: true },
      ],
      WELCOME: [
        { name: 'applicant_name', description: 'Nombre completo del postulante', required: true },
        { name: 'dashboard_link', description: 'Link al dashboard del postulante', required: true },
      ],
    };

    return variables[templateKey] || [];
  }

  /**
   * PATCH /api/email/templates/:id
   * 
   * Actualiza una plantilla editable.
   * Solo permite actualizar plantillas con is_editable = true.
   * 
   * @param id - UUID de la plantilla
   * @param body - DTO con campos opcionales: key, name, subjectTemplate, bodyTemplate
   * @returns Objeto con ok: true, updated: boolean
   * @throws BadRequestException si no existe o no es editable
   */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateEmailTemplateDto) {
    // Verificar si la plantilla es editable
    const checkResult = await this.ds.query(
      `SELECT is_editable as "isEditable" FROM email_templates WHERE id = $1`,
      [id],
    );

    if (!checkResult || checkResult.length === 0) {
      throw new BadRequestException('Template not found');
    }

    if (checkResult[0].isEditable === false) {
      throw new BadRequestException('This template is not editable');
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (body.key !== undefined) {
      fields.push(`key = $${idx++}`);
      values.push(body.key);
    }

    if (body.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(body.name);
    }

    if (body.subjectTemplate !== undefined) {
      fields.push(`text_subject = $${idx++}`);
      values.push(body.subjectTemplate);
    }

    if (body.bodyTemplate !== undefined) {
      fields.push(`text_content = $${idx++}`);
      values.push(body.bodyTemplate);
    }

    if (fields.length === 0) {
      return { ok: true, updated: false };
    }

    values.push(id);
    const sql = `UPDATE email_templates SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id`;
    const result = await this.ds.query(sql, values);

    if (!result || result.length === 0) {
      throw new BadRequestException('Template not found');
    }

    return { ok: true, updated: true };
  }

  /**
   * DELETE /api/email/templates/:id
   * 
   * Elimina una plantilla de email (solo si es editable).
   * Las plantillas del sistema (is_editable = false) no pueden ser eliminadas.
   * 
   * @param id - UUID de la plantilla a eliminar
   * @returns Objeto con success: true si se eliminó correctamente
   * @throws BadRequestException si no existe o no es editable
   */
  @Delete(':id')
  async delete(@Param('id') id: string) {
    // Verificar si la plantilla existe y es editable
    const checkResult = await this.ds.query(
      `SELECT is_editable as "isEditable" FROM email_templates WHERE id = $1`,
      [id],
    );

    if (!checkResult || checkResult.length === 0) {
      throw new BadRequestException('Template not found');
    }

    if (checkResult[0].isEditable === false) {
      throw new BadRequestException('System templates cannot be deleted');
    }

    await this.ds.query(
      `DELETE FROM email_templates WHERE id = $1`,
      [id],
    );

    return { success: true, message: 'Template deleted successfully' };
  }

  /**
   * POST /api/email/templates/:id/preview
   * 
   * Genera preview de una plantilla con datos de ejemplo.
   * 
   * Modo 1: Si se envía body con bodyTemplate/subjectTemplate, renderiza esas plantillas
   * Modo 2: Si no se envía body, renderiza la plantilla guardada en BD
   * 
   * @param id - UUID de la plantilla (se usa para obtener templateKey)
   * @param body - Opcional: bodyTemplate y subjectTemplate custom para preview
   * @returns Objeto con subject y body renderizados
   * @throws BadRequestException si no existe la plantilla
   */
  @Post(':id/preview')
  async preview(@Param('id') id: string, @Body() body?: { bodyTemplate?: string; subjectTemplate?: string }) {
    // Si se envía body con plantilla custom, renderizar esa
    if (body?.bodyTemplate) {
      const result = await this.ds.query(
        `SELECT key FROM email_templates WHERE id = $1`,
        [id],
      );
      
      if (!result || result.length === 0) {
        throw new BadRequestException('Template not found');
      }

      const templateKey = result[0].key;
      const renderedBody = this.templateRenderer.renderPreview(body.bodyTemplate, templateKey);
      const renderedSubject = body.subjectTemplate 
        ? this.templateRenderer.renderPreview(body.subjectTemplate, templateKey)
        : '';

      return {
        subject: renderedSubject,
        body: renderedBody,
      };
    }

    // Si no, renderizar la plantilla guardada
    const result = await this.ds.query(
      `SELECT key, subject_tpl, body_tpl FROM email_templates WHERE id = $1`,
      [id],
    );
    
    if (!result || result.length === 0) {
      throw new BadRequestException('Template not found');
    }

    const { key, subject_tpl, body_tpl } = result[0];
    
    return {
      subject: this.templateRenderer.renderPreview(subject_tpl, key),
      body: this.templateRenderer.renderPreview(body_tpl, key),
    };
  }
}
