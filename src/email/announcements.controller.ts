import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { EmailService, EmailCategory } from './email.service';
import { DataSource } from 'typeorm';

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

interface RecipientPreviewDto {
  recipientType: 'all' | 'specific' | 'milestone' | 'institutions-all' | 'institution-single';
  callId?: string;
  milestoneId?: string;
  applicantIds?: string[];
  institutionId?: string;
}

@Controller('announcements')
@Roles('ADMIN')
export class AnnouncementsController {
  constructor(
    private readonly emailService: EmailService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * POST /api/announcements/send
   * Envía avisos masivos según criterio
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
        const singleApplicant = await this.dataSource.query(
          `SELECT email, first_name, last_name 
           FROM applicants 
           WHERE email = $1`,
          [dto.singleEmail]
        );
        if (singleApplicant.length > 0) {
          recipients.push({ 
            email: singleApplicant[0].email, 
            name: `${singleApplicant[0].first_name} ${singleApplicant[0].last_name}` 
          });
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
   * POST /api/announcements/preview
   * Obtiene la lista de destinatarios sin enviar
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
   * GET /api/announcements/milestones/:callId
   * Obtiene lista de hitos de una convocatoria
   */
  @Get('milestones/:callId')
  async getMilestonesByCall(@Param('callId') callId: string) {
    const milestones = await this.dataSource.query(
      `SELECT id, title, description, who_can_fill as "whoCanFill"
       FROM milestones 
       WHERE call_id = $1 
       ORDER BY created_at`,
      [callId]
    );
    return milestones;
  }

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
