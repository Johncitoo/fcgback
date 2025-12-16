import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { TemplateRendererService, TemplateVariables } from './template-renderer.service';

export interface SendEmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export interface EmailQuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  resetAt: Date;
}

export interface DualEmailQuotaStatus {
  account1: EmailQuotaStatus & { name: string };
  account2: EmailQuotaStatus & { name: string };
  total: {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
  };
}

export enum EmailCategory {
  TRANSACTIONAL = 'TRANSACTIONAL', // Cuenta 1: Confirmaciones, password reset
  MASS = 'MASS', // Cuenta 2: Invitaciones masivas, anuncios
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  
  // API Configuration
  private readonly brevoApiUrl = 'https://api.brevo.com/v3/smtp/email';
  
  // Account 1 - Transactional emails
  private readonly brevoApiKey1: string;
  private readonly fromEmail1: string;
  private readonly fromName1: string;
  
  // Account 2 - Mass emails
  private readonly brevoApiKey2: string;
  private readonly fromEmail2: string;
  private readonly fromName2: string;
  
  // Shared configuration
  private readonly DAILY_LIMIT = 300; // Límite por cuenta

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly templateRenderer: TemplateRendererService,
  ) {
    // Account 1 - Transactional
    this.brevoApiKey1 = this.config.get<string>('BREVO_API_KEY_1') || this.config.get<string>('BREVO_API_KEY') || '';
    this.fromEmail1 = this.config.get<string>('EMAIL_FROM_1') || this.config.get<string>('EMAIL_FROM') || 'noreply@fcg.cl';
    this.fromName1 = this.config.get<string>('EMAIL_FROM_NAME_1') || this.config.get<string>('EMAIL_FROM_NAME') || 'Fundación Carmen Goudie';
    
    // Account 2 - Mass
    this.brevoApiKey2 = this.config.get<string>('BREVO_API_KEY_2') || '';
    this.fromEmail2 = this.config.get<string>('EMAIL_FROM_2') || this.fromEmail1;
    this.fromName2 = this.config.get<string>('EMAIL_FROM_NAME_2') || this.fromName1;
    
    this.logger.log('📧 Email Service inicializado con 2 cuentas Brevo + persistencia en BD');
    
    // Inicializar registro de hoy en la BD si no existe
    this.initializeTodayQuota().catch(err => {
      this.logger.error('Error inicializando quota:', err);
    });
  }
  
  /**
   * Inicializa o verifica el registro de cuota para hoy
   */
  private async initializeTodayQuota(): Promise<void> {
    try {
      const result = await this.dataSource.query(
        `INSERT INTO email_quota_tracking (tracking_date, account1_count, account2_count)
         VALUES (CURRENT_DATE, 0, 0)
         ON CONFLICT (tracking_date) DO NOTHING
         RETURNING id`,
      );
      
      if (result.length > 0) {
        this.logger.log('📧 Nuevo día - registro de cuota creado');
      }
    } catch (error) {
      this.logger.error('Error inicializando cuota del día:', error);
    }
  }

  /**
   * Obtiene los contadores actuales desde la BD
   */
  private async getCurrentQuota(): Promise<{ account1: number; account2: number }> {
    try {
      const result = await this.dataSource.query(
        `SELECT account1_count, account2_count 
         FROM email_quota_tracking 
         WHERE tracking_date = CURRENT_DATE`,
      );
      
      if (result.length === 0) {
        // No existe registro para hoy, crear uno
        await this.initializeTodayQuota();
        return { account1: 0, account2: 0 };
      }
      
      return {
        account1: result[0].account1_count || 0,
        account2: result[0].account2_count || 0,
      };
    } catch (error) {
      this.logger.error('Error obteniendo cuota actual:', error);
      return { account1: 0, account2: 0 };
    }
  }
  
  /**
   * Obtiene el estado de ambas cuentas de email desde la BD
   */
  async getDualQuotaStatus(): Promise<DualEmailQuotaStatus> {
    const quota = await this.getCurrentQuota();
    
    // Calcular cuándo se resetea (mañana a las 00:00 UTC)
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    
    const account1 = {
      name: 'Transaccional',
      used: quota.account1,
      limit: this.DAILY_LIMIT,
      remaining: Math.max(0, this.DAILY_LIMIT - quota.account1),
      percentage: Math.round((quota.account1 / this.DAILY_LIMIT) * 100),
      resetAt: tomorrow,
    };
    
    const account2 = {
      name: 'Masivos',
      used: quota.account2,
      limit: this.DAILY_LIMIT,
      remaining: Math.max(0, this.DAILY_LIMIT - quota.account2),
      percentage: Math.round((quota.account2 / this.DAILY_LIMIT) * 100),
      resetAt: tomorrow,
    };
    
    const totalUsed = quota.account1 + quota.account2;
    const totalLimit = this.DAILY_LIMIT * 2;
    
    return {
      account1,
      account2,
      total: {
        used: totalUsed,
        limit: totalLimit,
        remaining: Math.max(0, totalLimit - totalUsed),
        percentage: Math.round((totalUsed / totalLimit) * 100),
      },
    };
  }
  
  /**
   * Verifica si hay suficiente cuota disponible en una cuenta específica
   */
  async canSendEmails(count: number = 1, category: EmailCategory = EmailCategory.TRANSACTIONAL): Promise<boolean> {
    const status = await this.getDualQuotaStatus();
    const accountStatus = category === EmailCategory.TRANSACTIONAL ? status.account1 : status.account2;
    return accountStatus.remaining >= count;
  }
  
  /**
   * Incrementa el contador de emails enviados según la categoría en la BD
   */
  private async incrementCounter(category: EmailCategory): Promise<void> {
    try {
      const column = category === EmailCategory.TRANSACTIONAL ? 'account1_count' : 'account2_count';
      const accountName = category === EmailCategory.TRANSACTIONAL ? 'Cuenta 1' : 'Cuenta 2';
      
      await this.dataSource.query(
        `UPDATE email_quota_tracking 
         SET ${column} = ${column} + 1, updated_at = NOW()
         WHERE tracking_date = CURRENT_DATE`,
      );
      
      const quota = await this.getCurrentQuota();
      const currentCount = category === EmailCategory.TRANSACTIONAL ? quota.account1 : quota.account2;
      
      this.logger.log(`📊 [${accountName}] Emails enviados hoy: ${currentCount}/${this.DAILY_LIMIT}`);
    } catch (error) {
      this.logger.error(`Error incrementando contador para ${category}:`, error);
    }
  }

  async sendEmail(options: SendEmailOptions, category: EmailCategory = EmailCategory.TRANSACTIONAL): Promise<boolean> {
    // Seleccionar cuenta según categoría
    const apiKey = category === EmailCategory.TRANSACTIONAL ? this.brevoApiKey1 : this.brevoApiKey2;
    const fromEmail = category === EmailCategory.TRANSACTIONAL ? this.fromEmail1 : this.fromEmail2;
    const fromName = category === EmailCategory.TRANSACTIONAL ? this.fromName1 : this.fromName2;
    const accountName = category === EmailCategory.TRANSACTIONAL ? 'Cuenta 1' : 'Cuenta 2';
    
    // Verificar cuota antes de enviar
    const hasQuota = await this.canSendEmails(1, category);
    if (!hasQuota) {
      const status = await this.getDualQuotaStatus();
      const accountStatus = category === EmailCategory.TRANSACTIONAL ? status.account1 : status.account2;
      this.logger.error(`❌ [${accountName}] Cuota diaria agotada (${accountStatus.used}/${accountStatus.limit}). Reset: ${accountStatus.resetAt.toLocaleString()}`);
      throw new Error(`Límite diario de emails alcanzado en ${accountStatus.name} (${accountStatus.used}/${accountStatus.limit}). Intenta mañana.`);
    }
    
    // Si no hay API key configurada, solo loguear (modo desarrollo)
    if (!apiKey) {
      this.logger.warn(`[${accountName}] API key no configurada. Email no enviado (modo desarrollo)`);
      this.logger.log(`Email simulado a: ${options.to}`);
      this.logger.log(`Asunto: ${options.subject}`);
      await this.incrementCounter(category);
      return true;
    }

    try {
      const response = await fetch(this.brevoApiUrl, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: fromName,
            email: fromEmail,
          },
          to: [{ email: options.to }],
          subject: options.subject,
          htmlContent: options.htmlContent,
          textContent: options.textContent || options.htmlContent.replace(/<[^>]*>/g, ''),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`[${accountName}] Error al enviar email: ${errorText}`);
        return false;
      }

      await this.incrementCounter(category);
      this.logger.log(`✅ [${accountName}] Email enviado a: ${options.to}`);
      return true;
    } catch (error) {
      this.logger.error(`[${accountName}] Error al enviar email: ${error}`);
      return false;
    }
  }

  async sendPasswordSetEmail(email: string, token: string, applicantName?: string): Promise<boolean> {
    const baseUrl = this.config.get<string>('FRONTEND_URL') || 'https://fcgfront.vercel.app';
    const setPasswordUrl = `${baseUrl}/#/set-password?token=${token}`;

    const subject = 'Establece tu contraseña - Fundación Carmen Goudie';
    
    const htmlContent = `
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
          <h2 style="color: #0369a1; margin-top: 0;">Hola${applicantName ? ' ' + applicantName : ''},</h2>
          
          <p>Tu código de invitación ha sido validado exitosamente. Ahora puedes establecer tu contraseña para acceder al sistema de postulaciones.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${setPasswordUrl}" 
               style="background-color: #0369a1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Establecer mi contraseña
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Si el botón no funciona, copia y pega este enlace en tu navegador:
          </p>
          <p style="word-break: break-all; color: #0369a1; font-size: 12px;">
            ${setPasswordUrl}
          </p>
          
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-top: 20px;">
            <p style="margin: 0; font-size: 14px;">
              <strong>⚠️ Importante:</strong> Este enlace es válido por 24 horas y solo puede usarse una vez.
            </p>
          </div>
        </div>
        
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; margin-top: 20px;">
          <p style="margin: 5px 0;">© ${new Date().getFullYear()} Fundación Carmen Goudie</p>
          <p style="margin: 5px 0;">Este es un correo automático, por favor no respondas a este mensaje.</p>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(
      {
        to: email,
        subject,
        htmlContent,
      },
      EmailCategory.TRANSACTIONAL
    );
  }

  async sendInitialInviteEmail(email: string, code: string, callName?: string, fullName?: string): Promise<boolean> {
    const baseUrl = this.config.get<string>('FRONTEND_URL') || 'https://fcgfront.vercel.app';
    const applyUrl = `${baseUrl}/#/login`;
    
    const subject = 'Invitación para postular - Fundación Carmen Goudie';
    
    const greeting = fullName ? `¡Hola ${fullName}!` : '¡Hola!';
    
    const htmlContent = `
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
          <h2 style="color: #0369a1; margin-top: 0;">${greeting}</h2>
          
          <p>Has recibido una invitación para postular a ${callName ? `<strong>${callName}</strong>` : 'una convocatoria'} de la Fundación Carmen Goudie.</p>
          
          <div style="background-color: #dbeafe; border: 2px solid #0369a1; padding: 20px; text-align: center; margin: 30px 0; border-radius: 8px;">
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">Tu código de invitación:</p>
            <p style="margin: 0; font-size: 28px; font-weight: bold; color: #0369a1; letter-spacing: 2px; font-family: 'Courier New', monospace;">
              ${code}
            </p>
          </div>
          
          <p>Para iniciar tu postulación:</p>
          <ol style="line-height: 1.8;">
            <li>Ingresa al portal de postulaciones</li>
            <li>Introduce tu código de invitación</li>
            <li>Completa tu información personal</li>
            <li>Sube los documentos requeridos</li>
          </ol>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${applyUrl}" 
               style="background-color: #0369a1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Iniciar Postulación
            </a>
          </div>
          
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-top: 20px;">
            <p style="margin: 0; font-size: 14px;">
              <strong>⚠️ Importante:</strong> Este código es único y personal. No lo compartas con nadie.
            </p>
          </div>
        </div>
        
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; margin-top: 20px;">
          <p style="margin: 5px 0;">© ${new Date().getFullYear()} Fundación Carmen Goudie</p>
          <p style="margin: 5px 0;">Este es un correo automático, por favor no respondas a este mensaje.</p>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(
      {
        to: email,
        subject,
        htmlContent,
      },
      EmailCategory.MASS
    );
  }

  async sendInviteResentEmail(email: string, newCode: string): Promise<boolean> {
    const subject = 'Nuevo código de invitación - Fundación Carmen Goudie';
    
    const htmlContent = `
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
          <h2 style="color: #0369a1; margin-top: 0;">Nuevo código de invitación</h2>
          
          <p>Se ha generado un nuevo código de invitación para tu postulación. Tu código anterior ha sido invalidado.</p>
          
          <div style="background-color: #dbeafe; border: 2px solid #0369a1; padding: 20px; text-align: center; margin: 30px 0; border-radius: 8px;">
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">Tu código de invitación:</p>
            <p style="margin: 0; font-size: 28px; font-weight: bold; color: #0369a1; letter-spacing: 2px; font-family: 'Courier New', monospace;">
              ${newCode}
            </p>
          </div>
          
          <p>Usa este código para iniciar tu postulación en nuestro sistema.</p>
          
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-top: 20px;">
            <p style="margin: 0; font-size: 14px;">
              <strong>⚠️ Importante:</strong> Este código es único y personal. No lo compartas con nadie.
            </p>
          </div>
        </div>
        
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; margin-top: 20px;">
          <p style="margin: 5px 0;">© ${new Date().getFullYear()} Fundación Carmen Goudie</p>
          <p style="margin: 5px 0;">Este es un correo automático, por favor no respondas a este mensaje.</p>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(
      {
        to: email,
        subject,
        htmlContent,
      },
      EmailCategory.MASS
    );
  }

  // ========================================
  // MÉTODOS CON PLANTILLAS DE BD
  // ========================================

  /**
   * Envía email usando plantilla de BD
   * @param templateKey Clave de la plantilla (ej: 'PASSWORD_RESET')
   * @param to Email destino
   * @param variables Variables para reemplazar en la plantilla
   * @param category Categoría del email (TRANSACTIONAL o MASS)
   */
  async sendFromTemplate(
    templateKey: string,
    to: string,
    variables: TemplateVariables,
    category: EmailCategory = EmailCategory.TRANSACTIONAL,
  ): Promise<boolean> {
    try {
      // Obtener plantilla de BD
      const result = await this.dataSource.query(
        `SELECT subject_tpl, body_tpl FROM email_templates WHERE key = $1 LIMIT 1`,
        [templateKey],
      );

      if (!result || result.length === 0) {
        this.logger.error(`Plantilla no encontrada: ${templateKey}`);
        return false;
      }

      const { subject_tpl, body_tpl } = result[0];

      // Renderizar plantilla con variables
      const subject = this.templateRenderer.render(subject_tpl, variables);
      const htmlContent = this.templateRenderer.render(body_tpl, variables);

      // Enviar email
      return this.sendEmail({ to, subject, htmlContent }, category);
    } catch (error) {
      this.logger.error(`Error enviando email con plantilla ${templateKey}:`, error);
      return false;
    }
  }

  /**
   * Envía email de recuperación de contraseña usando plantilla BD
   */
  async sendPasswordResetEmail(email: string, token: string, applicantName: string): Promise<boolean> {
    const baseUrl = this.config.get<string>('FRONTEND_URL') || 'https://fcgfront.vercel.app';
    const resetLink = `${baseUrl}/#/reset-password?token=${token}`;

    return this.sendFromTemplate(
      'PASSWORD_RESET',
      email,
      {
        applicant_name: applicantName,
        reset_link: resetLink,
      },
      EmailCategory.TRANSACTIONAL,
    );
  }

  /**
   * Envía confirmación de formulario enviado usando plantilla BD
   */
  async sendFormSubmittedEmail(
    email: string,
    applicantName: string,
    callName: string,
    formName: string,
  ): Promise<boolean> {
    const baseUrl = this.config.get<string>('FRONTEND_URL') || 'https://fcgfront.vercel.app';
    const dashboardLink = `${baseUrl}/#/dashboard`;
    const submissionDate = new Date().toLocaleString('es-ES', {
      dateStyle: 'long',
      timeStyle: 'short',
    });

    return this.sendFromTemplate(
      'FORM_SUBMITTED',
      email,
      {
        applicant_name: applicantName,
        call_name: callName,
        form_name: formName,
        submission_date: submissionDate,
        dashboard_link: dashboardLink,
      },
      EmailCategory.TRANSACTIONAL,
    );
  }

  /**
   * Envía notificación de hito aprobado usando plantilla BD
   */
  async sendMilestoneApprovedEmail(
    email: string,
    applicantName: string,
    callName: string,
    milestoneName: string,
    nextMilestoneName?: string,
  ): Promise<boolean> {
    const baseUrl = this.config.get<string>('FRONTEND_URL') || 'https://fcgfront.vercel.app';
    const dashboardLink = `${baseUrl}/#/dashboard`;

    return this.sendFromTemplate(
      'MILESTONE_APPROVED',
      email,
      {
        applicant_name: applicantName,
        call_name: callName,
        milestone_name: milestoneName,
        next_milestone_name: nextMilestoneName || 'Próximo paso',
        dashboard_link: dashboardLink,
      },
      EmailCategory.TRANSACTIONAL,
    );
  }

  /**
   * Envía notificación de hito rechazado (ÚLTIMO EMAIL) usando plantilla BD
   */
  async sendMilestoneRejectedEmail(
    email: string,
    applicantName: string,
    callName: string,
    milestoneName: string,
  ): Promise<boolean> {
    return this.sendFromTemplate(
      'MILESTONE_REJECTED',
      email,
      {
        applicant_name: applicantName,
        call_name: callName,
        milestone_name: milestoneName,
      },
      EmailCategory.TRANSACTIONAL,
    );
  }

  /**
   * Envía notificación de correcciones requeridas usando plantilla BD
   */
  async sendMilestoneNeedsChangesEmail(
    email: string,
    applicantName: string,
    callName: string,
    milestoneName: string,
    reviewerComments: string,
  ): Promise<boolean> {
    const baseUrl = this.config.get<string>('FRONTEND_URL') || 'https://fcgfront.vercel.app';
    const dashboardLink = `${baseUrl}/#/dashboard`;

    return this.sendFromTemplate(
      'MILESTONE_NEEDS_CHANGES',
      email,
      {
        applicant_name: applicantName,
        call_name: callName,
        milestone_name: milestoneName,
        reviewer_comments: reviewerComments,
        dashboard_link: dashboardLink,
      },
      EmailCategory.TRANSACTIONAL,
    );
  }

  /**
   * Envía email de bienvenida usando plantilla BD
   */
  async sendWelcomeEmail(email: string, applicantName: string): Promise<boolean> {
    const baseUrl = this.config.get<string>('FRONTEND_URL') || 'https://fcgfront.vercel.app';
    const dashboardLink = `${baseUrl}/#/dashboard`;

    return this.sendFromTemplate(
      'WELCOME',
      email,
      {
        applicant_name: applicantName,
        dashboard_link: dashboardLink,
      },
      EmailCategory.TRANSACTIONAL,
    );
  }
}
