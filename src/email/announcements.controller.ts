import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { EmailService, EmailCategory } from './email.service';
import { DataSource } from 'typeorm';

/**
 * DTO para envío de anuncio.
 * 
 * recipientType determina los destinatarios:
 * - 'all': Todos los postulantes de callId
 * - 'milestone': Postulantes en estado pending del milestoneId
 * - 'specific': Lista de applicantIds
 * - 'single': Un solo singleEmail
 * - 'institutions-all': Todas las instituciones con email
 * - 'institution-single': Una institución por institutionId
 */
interface SendAnnouncementDto {
  subject: string;
  message: string;
  recipientType: 'all' | 'specific' | 'milestone' | 'single' | 'institutions-all' | 'institution-single';
  callId?: string;
  milestoneId?: string;
  applicantIds?: string[];
  singleEmail?: string;
  institutionId?: string;
}

/**
 * DTO para preview de destinatarios (sin enviar emails).
 */
interface RecipientPreviewDto {
  recipientType: 'all' | 'specific' | 'milestone' | 'institutions-all' | 'institution-single';
  callId?: string;
  milestoneId?: string;
  applicantIds?: string[];
  institutionId?: string;
}

/**
 * Controlador para envío de anuncios masivos.
 * 
 * Permite enviar emails a grupos de destinatarios:
 * - Todos los postulantes de una convocatoria
 * - Postulantes en un hito específico (estado pending)
 * - Selección manual de postulantes
 * - Email individual
 * - Todas las instituciones
 * - Institución específica
 * 
 * Funcionalidades:
 * - Envío masivo con verificación de cuota
 * - Preview de destinatarios antes de enviar
 * - Helpers para obtener postulantes y hitos de una convocatoria
 * - Plantilla de email HTML con formato institucional
 * 
 * Seguridad: Solo ADMIN
 */
@Controller('announcements')
@Roles('ADMIN')
export class AnnouncementsController {
  constructor(
    private readonly emailService: EmailService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Envía avisos masivos a destinatarios según criterio.
   * Soporta envío a todos los postulantes, hito específico, selección manual, email individual o instituciones.
   * Valida cuota disponible antes de enviar.
   * 
   * @param dto - Configuración del envío (subject, message, recipientType, etc.)
   * @returns Resumen de envío con total, exitosos y errores
   * @throws {Error} Si faltan parámetros requeridos o cuota insuficiente
   * 
   * @example
   * POST /api/announcements/send
   * Body: { "subject": "Aviso", "message": "Texto", "recipientType": "all", "callId": "uuid" }
   */
  @Post('send')
  async sendAnnouncement(@Body() dto: SendAnnouncementDto) {
    const recipients: Array<{ email: string; name: string }> = [];

    // Obtener destinatarios según tipo
    switch (dto.recipientType) {
      case 'all':
        if (!dto.callId) throw new Error('callId requerido para envío masivo');
        const allApplicants = await this.dataSource.query(
          `SELECT DISTINCT a.email, a.first_name, a.last_name 
           FROM applicants a
           INNER JOIN applications app ON a.id = app.applicant_id
           WHERE app.call_id = $1 AND a.email IS NOT NULL`,
          [dto.callId]
        );
        recipients.push(...allApplicants.map(a => ({ 
          email: a.email, 
          name: `${a.first_name} ${a.last_name}` 
        })));
        break;

      case 'milestone':
        if (!dto.milestoneId) throw new Error('milestoneId requerido');
        const milestoneApplicants = await this.dataSource.query(
          `SELECT DISTINCT a.email, a.first_name, a.last_name
           FROM applicants a
           INNER JOIN applications app ON a.id = app.applicant_id
           INNER JOIN milestone_progress mp ON app.id = mp.application_id
           WHERE mp.milestone_id = $1 
             AND mp.status = 'pending'
             AND a.email IS NOT NULL`,
          [dto.milestoneId]
        );
        recipients.push(...milestoneApplicants.map(a => ({ 
          email: a.email, 
          name: `${a.first_name} ${a.last_name}` 
        })));
        break;

      case 'specific':
        if (!dto.applicantIds || dto.applicantIds.length === 0) {
          throw new Error('applicantIds requerido para envío específico');
        }
        const specificApplicants = await this.dataSource.query(
          `SELECT email, first_name, last_name 
           FROM applicants 
           WHERE id = ANY($1) AND email IS NOT NULL`,
          [dto.applicantIds]
        );
        recipients.push(...specificApplicants.map(a => ({ 
          email: a.email, 
          name: `${a.first_name} ${a.last_name}` 
        })));
        break;

      case 'single':
        if (!dto.singleEmail) throw new Error('singleEmail requerido');
        // Enviar directamente al email proporcionado, sin buscar en base de datos
        // Intentar obtener nombre si existe en applicants o institutions
        const checkApplicant = await this.dataSource.query(
          `SELECT email, first_name, last_name 
           FROM applicants 
           WHERE LOWER(email) = LOWER($1)
           LIMIT 1`,
          [dto.singleEmail]
        );
        
        if (checkApplicant.length > 0) {
          recipients.push({ 
            email: checkApplicant[0].email, 
            name: `${checkApplicant[0].first_name} ${checkApplicant[0].last_name}` 
          });
        } else {
          // Si no está en applicants, buscar en institutions
          const checkInstitution = await this.dataSource.query(
            `SELECT email, name 
             FROM institutions 
             WHERE LOWER(email) = LOWER($1)
             LIMIT 1`,
            [dto.singleEmail]
          );
          
          if (checkInstitution.length > 0) {
            recipients.push({ 
              email: checkInstitution[0].email, 
              name: checkInstitution[0].name 
            });
          } else {
            // Si no está en ninguna tabla, usar el email como nombre
            recipients.push({ 
              email: dto.singleEmail, 
              name: dto.singleEmail 
            });
          }
        }
        break;

      case 'institutions-all':
        const allInstitutions = await this.dataSource.query(
          `SELECT DISTINCT i.id, i.email, i.name
           FROM institutions i
           WHERE i.email IS NOT NULL AND i.email != ''`
        );
        recipients.push(...allInstitutions.map(i => ({ 
          email: i.email, 
          name: i.name 
        })));
        break;

      case 'institution-single':
        if (!dto.institutionId) throw new Error('institutionId requerido');
        const singleInstitution = await this.dataSource.query(
          `SELECT email, name 
           FROM institutions 
           WHERE id = $1 AND email IS NOT NULL`,
          [dto.institutionId]
        );
        if (singleInstitution.length > 0) {
          recipients.push({ 
            email: singleInstitution[0].email, 
            name: singleInstitution[0].name 
          });
        }
        break;
    }

    // Verificar cuota antes de enviar
    const hasQuota = await this.emailService.canSendEmails(recipients.length, EmailCategory.MASS);
    if (!hasQuota) {
      const quotaStatus = await this.emailService.getDualQuotaStatus();
      throw new Error(
        `Cuota insuficiente para enviar ${recipients.length} emails. ` +
        `Disponibles: ${quotaStatus.account2.remaining} en cuenta de Masivos.`
      );
    }

    // Enviar emails
    const results = {
      total: recipients.length,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const recipient of recipients) {
      try {
        const htmlContent = this.buildAnnouncementEmail(recipient.name, dto.subject, dto.message);
        const success = await this.emailService.sendEmail(
          {
            to: recipient.email,
            subject: dto.subject,
            htmlContent,
          },
          EmailCategory.MASS
        );

        if (success) {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push(`Error enviando a ${recipient.email}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Error enviando a ${recipient.email}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Obtiene la lista de destinatarios sin enviar emails.
   * Útil para previsualizar quiénes recibirán el anuncio.
   * 
   * @param dto - Configuración de destinatarios (recipientType, callId, milestoneId, etc.)
   * @returns Conteo y lista de destinatarios con id, email y nombre
   * @throws {Error} Si faltan parámetros requeridos
   * 
   * @example
   * POST /api/announcements/preview
   * Body: { "recipientType": "all", "callId": "uuid" }
   * Response: { "count": 50, "recipients": [{ "id": "uuid", "email": "...", "name": "..." }] }
   */
  @Post('preview')
  async previewRecipients(@Body() dto: RecipientPreviewDto) {
    const recipients: Array<{ id: string; email: string; name: string }> = [];

    switch (dto.recipientType) {
      case 'all':
        if (!dto.callId) throw new Error('callId requerido');
        const allApplicants = await this.dataSource.query(
          `SELECT DISTINCT a.id, a.email, a.first_name, a.last_name 
           FROM applicants a
           INNER JOIN applications app ON a.id = app.applicant_id
           WHERE app.call_id = $1 AND a.email IS NOT NULL
           ORDER BY a.last_name, a.first_name`,
          [dto.callId]
        );
        recipients.push(...allApplicants.map(a => ({ 
          id: a.id,
          email: a.email, 
          name: `${a.first_name} ${a.last_name}` 
        })));
        break;

      case 'milestone':
        if (!dto.milestoneId) throw new Error('milestoneId requerido');
        const milestoneApplicants = await this.dataSource.query(
          `SELECT DISTINCT a.id, a.email, a.first_name, a.last_name
           FROM applicants a
           INNER JOIN applications app ON a.id = app.applicant_id
           INNER JOIN milestone_progress mp ON app.id = mp.application_id
           WHERE mp.milestone_id = $1 
             AND mp.status = 'pending'
             AND a.email IS NOT NULL
           ORDER BY a.last_name, a.first_name`,
          [dto.milestoneId]
        );
        recipients.push(...milestoneApplicants.map(a => ({ 
          id: a.id,
          email: a.email, 
          name: `${a.first_name} ${a.last_name}` 
        })));
        break;

      case 'specific':
        if (!dto.applicantIds || dto.applicantIds.length === 0) {
          throw new Error('applicantIds requerido');
        }
        const specificApplicants = await this.dataSource.query(
          `SELECT id, email, first_name, last_name 
           FROM applicants 
           WHERE id = ANY($1) AND email IS NOT NULL
           ORDER BY last_name, first_name`,
          [dto.applicantIds]
        );
        recipients.push(...specificApplicants.map(a => ({ 
          id: a.id,
          email: a.email, 
          name: `${a.first_name} ${a.last_name}` 
        })));
        break;

      case 'institutions-all':
        const allInstitutions = await this.dataSource.query(
          `SELECT id, email, name
           FROM institutions
           WHERE email IS NOT NULL AND email != ''
           ORDER BY name`
        );
        recipients.push(...allInstitutions.map(i => ({ 
          id: i.id,
          email: i.email, 
          name: i.name 
        })));
        break;

      case 'institution-single':
        if (!dto.institutionId) throw new Error('institutionId requerido');
        const singleInstitution = await this.dataSource.query(
          `SELECT id, email, name 
           FROM institutions 
           WHERE id = $1 AND email IS NOT NULL`,
          [dto.institutionId]
        );
        if (singleInstitution.length > 0) {
          recipients.push({ 
            id: singleInstitution[0].id,
            email: singleInstitution[0].email, 
            name: singleInstitution[0].name 
          });
        }
        break;
    }

    return {
      count: recipients.length,
      recipients,
    };
  }

  /**
   * Obtiene lista de postulantes de una convocatoria.
   * Retorna solo postulantes con email válido.
   * 
   * @param callId - ID de la convocatoria
   * @returns Array de postulantes ordenados por nombre
   * 
   * @example
   * GET /api/announcements/applicants/uuid-call-123
   */
  @Get('applicants/:callId')
  async getApplicantsByCall(@Param('callId') callId: string) {
    const applicants = await this.dataSource.query(
      `SELECT DISTINCT a.id, a.email, a.first_name, a.last_name
       FROM applicants a
       INNER JOIN applications app ON a.id = app.applicant_id
       WHERE app.call_id = $1 AND a.email IS NOT NULL
       ORDER BY a.first_name, a.last_name`,
      [callId]
    );
    return applicants;
  }

  /**
   * Obtiene lista de hitos de una convocatoria.
   * Ordenados por orderIndex ascendente.
   * 
   * @param callId - ID de la convocatoria
   * @returns Array de hitos con id, name, description y whoCanFill
   * 
   * @example
   * GET /api/announcements/milestones/uuid-call-123
   */
  @Get('milestones/:callId')
  async getMilestonesByCall(@Param('callId') callId: string) {
    const milestones = await this.dataSource.query(
      `SELECT id, name, description, order_index, who_can_fill as "whoCanFill"
       FROM milestones 
       WHERE call_id = $1 
       ORDER BY order_index ASC`,
      [callId]
    );
    return milestones;
  }

  /**
   * Construye el HTML del email de anuncio con formato institucional.
   * Incluye header con logo de fundación y footer con copyright.
   * 
   * @param recipientName - Nombre del destinatario
   * @param subject - Asunto del email (no usado en el HTML)
   * @param message - Mensaje del anuncio (saltos de línea convertidos a <br>)
   * @returns HTML formateado del email
   * 
   * @example
   * const html = this.buildAnnouncementEmail('Juan Pérez', 'Aviso', 'Mensaje de prueba');
   */
  private buildAnnouncementEmail(recipientName: string, subject: string, message: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #0369a1; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Fundación Carmen Goudie</h1>
        </div>
        
        <div style="background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb;">
          <h2 style="color: #0369a1; margin-top: 0;">Hola ${recipientName},</h2>
          
          <div style="background-color: white; padding: 20px; border-left: 4px solid #0369a1; margin: 20px 0;">
            ${message.replace(/\n/g, '<br>')}
          </div>
        </div>
        
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; margin-top: 20px;">
          <p style="margin: 5px 0;">© ${new Date().getFullYear()} Fundación Carmen Goudie</p>
          <p style="margin: 5px 0;">Este es un correo automático, por favor no respondas a este mensaje.</p>
        </div>
      </body>
      </html>
    `;
  }
}
