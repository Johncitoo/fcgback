import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { TemplateRendererService, TemplateVariables } from './template-renderer.service';
import { AuditService } from '../common/audit.service';
import { EmailTemplateHelper } from './email-template.helper';

/**
 * Opciones para envío de email individual.
 */
export interface SendEmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

/**
 * Estado de cuota de una cuenta de email.
 */
export interface EmailQuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  resetAt: Date;
}

/**
 * Estado combinado de ambas cuentas de email (transaccional y masivos).
 */
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

/**
 * Categorías de email para selección de cuenta.
 * 
 * - TRANSACTIONAL: Emails automáticos críticos (confirmaciones, password reset)
 *   Usa cuenta 1 configurada con BREVO_API_KEY_1
 * 
 * - MASS: Emails masivos (invitaciones, anuncios)
 *   Usa cuenta 2 configurada con BREVO_API_KEY_2
 */
export enum EmailCategory {
  TRANSACTIONAL = 'TRANSACTIONAL', // Cuenta 1: Confirmaciones, password reset
  MASS = 'MASS', // Cuenta 2: Invitaciones masivas, anuncios
}

/**
 * Servicio de envío de emails usando Brevo API.
 * 
 * Características:
 * - Sistema dual de cuentas para separar transaccionales y masivos
 * - Cuotas diarias persistidas en BD (300 emails por cuenta/día)
 * - Verificación de cuota antes de enviar
 * - Logging detallado de cada envío
 * - Plantillas hardcoded y basadas en BD con variables
 * - Modo desarrollo (sin API key loguea pero no envía)
 * 
 * Cuentas:
 * - Cuenta 1 (TRANSACTIONAL): Password reset, confirmaciones, notificaciones de hitos
 * - Cuenta 2 (MASS): Invitaciones masivas, anuncios
 * 
 * Variables de entorno requeridas:
 * - BREVO_API_KEY_1: API key cuenta transaccional
 * - BREVO_API_KEY_2: API key cuenta masivos
 * - EMAIL_FROM_1, EMAIL_FROM_NAME_1: Remitente cuenta 1
 * - EMAIL_FROM_2, EMAIL_FROM_NAME_2: Remitente cuenta 2
 * - FRONTEND_URL: URL base para links en emails
 */
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
    private readonly auditService: AuditService,
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
   * Inicializa el registro de cuota para el día actual si no existe.
   * Se ejecuta automáticamente en el constructor.
   * Usa ON CONFLICT DO NOTHING para evitar duplicados.
   */
  private async initializeTodayQuota(): Promise<void> {
    try {
      const result = await this.dataSource.query(
        `INSERT INTO email_quota_tracking (id, tracking_date, account1_count, account2_count)
         VALUES (gen_random_uuid(), CURRENT_DATE, 0, 0)
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
   * Obtiene los contadores de emails enviados hoy para ambas cuentas.
   * Si no existe registro para hoy, inicializa uno nuevo.
   * 
   * @returns Objeto con account1 y account2 counts
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
   * Obtiene el estado completo de cuotas de ambas cuentas.
   * Incluye used, limit, remaining, percentage y resetAt para cada cuenta,
   * más totales combinados.
   * 
   * @returns DualEmailQuotaStatus con estado de cuenta 1, cuenta 2 y totales
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
   * Verifica si hay suficiente cuota disponible para enviar N emails.
   * 
   * @param count - Número de emails a enviar (default: 1)
   * @param category - Categoría/cuenta a usar (default: TRANSACTIONAL)
   * @returns true si hay cuota disponible, false si está agotada
   */
  async canSendEmails(count: number = 1, category: EmailCategory = EmailCategory.TRANSACTIONAL): Promise<boolean> {
    const status = await this.getDualQuotaStatus();
    const accountStatus = category === EmailCategory.TRANSACTIONAL ? status.account1 : status.account2;
    return accountStatus.remaining >= count;
  }
  
  /**
   * Incrementa el contador de emails enviados hoy en la BD.
   * Actualiza la columna correspondiente según la categoría.
   * 
   * @param category - Categoría del email (determina qué columna incrementar)
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

  /**
   * Envía un email usando Brevo API.
   * 
   * Flujo:
   * 1. Selecciona cuenta según categoría
   * 2. Verifica cuota disponible (rechaza si agotada)
   * 3. Envía email via Brevo API
   * 4. Incrementa contador si exitoso
   * 5. Retorna true/false según resultado
   * 
   * Modo desarrollo: Si no hay API key, loguea pero no envía (retorna true)
   * 
   * @param options - Opciones del email (to, subject, htmlContent, textContent)
   * @param category - Categoría para seleccionar cuenta (default: TRANSACTIONAL)
   * @returns true si se envió exitosamente, false en caso de error
   * @throws Error si la cuota diaria está agotada
   */
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

  /**
   * Envía email con link para establecer contraseña inicial.
   * Usado después de validar código de invitación.
   * Plantilla hardcoded con HTML inline.
   * 
   * @param email - Email destino
   * @param token - Token JWT de un solo uso (válido 24h)
   * @param applicantName - Nombre del postulante (opcional)
   * @returns true si se envió exitosamente
   */
  async sendPasswordSetEmail(email: string, token: string, applicantName?: string): Promise<boolean> {
    const baseUrl = this.config.get<string>('FRONTEND_URL') || 'https://fcgfront.vercel.app';
    const setPasswordUrl = `${baseUrl}/#/set-password?token=${token}`;

    const subject = 'Establece tu contraseña - Fundación Carmen Goudie';
    
    const content = `
      ${EmailTemplateHelper.greeting(applicantName)}
      ${EmailTemplateHelper.paragraph('Tu código de invitación ha sido validado exitosamente. Ahora puedes establecer tu contraseña para acceder al sistema de postulaciones.')}
      ${EmailTemplateHelper.button('Establecer mi contraseña', setPasswordUrl)}
      ${EmailTemplateHelper.linkFallback(setPasswordUrl)}
      ${EmailTemplateHelper.warningNote('Importante', 'Este enlace es válido por 24 horas y solo puede usarse una vez.')}
    `;

    const htmlContent = EmailTemplateHelper.wrapEmail(content);

    return this.sendEmail(
      {
        to: email,
        subject,
        htmlContent,
      },
      EmailCategory.TRANSACTIONAL
    );
  }

  /**
   * Envía email de invitación inicial con código para postular.
   * Plantilla hardcoded con HTML inline.
   * Usa categoría MASS (cuenta 2) para envíos masivos.
   * 
   * @param email - Email destino
   * @param code - Código de invitación (formato: ABC-123-XYZ)
   * @param callName - Nombre de la convocatoria (opcional)
   * @param fullName - Nombre completo del postulante (opcional)
   * @returns true si se envió exitosamente
   */
  async sendInitialInviteEmail(email: string, code: string, callName?: string, fullName?: string): Promise<boolean> {
    const baseUrl = this.config.get<string>('FRONTEND_URL') || 'https://fcgfront.vercel.app';
    const applyUrl = `${baseUrl}/#/login`;
    
    const subject = 'Invitación para postular - Fundación Carmen Goudie';
    
    const callText = callName ? `<strong>${callName}</strong>` : 'una convocatoria';
    
    const content = `
      ${EmailTemplateHelper.greeting(fullName)}
      ${EmailTemplateHelper.paragraph(`Has recibido una invitación para postular a ${callText} de la Fundación Carmen Goudie.`)}
      ${EmailTemplateHelper.codeBox('Tu código de invitación', code)}
      ${EmailTemplateHelper.paragraph('Para iniciar tu postulación:')}
      ${EmailTemplateHelper.orderedList([
        'Ingresa al portal de postulaciones',
        'Introduce tu código de invitación',
        'Completa tu información personal',
        'Sube los documentos requeridos'
      ])}
      ${EmailTemplateHelper.button('Iniciar Postulación', applyUrl)}
      ${EmailTemplateHelper.warningNote('Importante', 'Este código es único y personal. No lo compartas con nadie.')}
    `;

    const htmlContent = EmailTemplateHelper.wrapEmail(content);

    return this.sendEmail(
      {
        to: email,
        subject,
        htmlContent,
      },
      EmailCategory.MASS
    );
  }

  /**
   * Envía email con nuevo código de invitación.
   * Usado cuando se regenera un código (el anterior queda invalidado).
   * Plantilla hardcoded con HTML inline.
   * 
   * @param email - Email destino
   * @param newCode - Nuevo código de invitación
   * @returns true si se envió exitosamente
   */
  async sendInviteResentEmail(email: string, newCode: string): Promise<boolean> {
    const subject = 'Nuevo código de invitación - Fundación Carmen Goudie';
    
    const content = `
      ${EmailTemplateHelper.greeting()}
      ${EmailTemplateHelper.paragraph('Se ha generado un nuevo código de invitación para tu postulación. Tu código anterior ha sido invalidado.')}
      ${EmailTemplateHelper.codeBox('Tu código de invitación', newCode)}
      ${EmailTemplateHelper.paragraph('Usa este código para iniciar tu postulación en nuestro sistema.')}
      ${EmailTemplateHelper.warningNote('Importante', 'Este código es único y personal. No lo compartas con nadie.')}
    `;

    const htmlContent = EmailTemplateHelper.wrapEmail(content);

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
   * Envía email usando plantilla almacenada en la tabla email_templates.
   * 
   * Flujo:
   * 1. Busca plantilla por key en BD
   * 2. Renderiza subject_tpl y body_tpl con variables usando TemplateRendererService
   * 3. Envía email con el contenido renderizado
   * 
   * @param templateKey - Clave de la plantilla (ej: 'PASSWORD_RESET', 'FORM_SUBMITTED')
   * @param to - Email destino
   * @param variables - Variables para reemplazar en la plantilla ({{variable_name}})
   * @param category - Categoría del email (default: TRANSACTIONAL)
   * @returns true si se envió exitosamente, false si no existe la plantilla o falla el envío
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
   * Envía email de recuperación de contraseña.
   * Usa plantilla 'PASSWORD_RESET' de BD.
   * 
   * Variables: applicant_name, reset_link
   * 
   * @param email - Email destino
   * @param token - Token JWT de un solo uso para reset
   * @param applicantName - Nombre del postulante
   * @returns true si se envió exitosamente
   */
  async sendPasswordResetEmail(email: string, token: string, applicantName: string): Promise<boolean> {
    const baseUrl = this.config.get<string>('FRONTEND_URL') || 'https://fcgfront.vercel.app';
    const resetLink = `${baseUrl}/auth/reset-password?token=${token}`;

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
   * Envía confirmación de que un formulario fue enviado.
   * Usa plantilla 'FORM_SUBMITTED' de BD.
   * 
   * Variables: applicant_name, call_name, form_name, submission_date, dashboard_link
   * 
   * @param email - Email del postulante
   * @param applicantName - Nombre del postulante
   * @param callName - Nombre de la convocatoria
   * @param formName - Nombre del formulario enviado
   * @returns true si se envió exitosamente
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
   * Envía notificación de que un hito fue aprobado.
   * Usa plantilla 'MILESTONE_APPROVED' de BD.
   * 
   * Variables: applicant_name, call_name, milestone_name, next_milestone_name, dashboard_link
   * 
   * @param email - Email del postulante
   * @param applicantName - Nombre del postulante
   * @param callName - Nombre de la convocatoria
   * @param milestoneName - Nombre del hito aprobado
   * @param nextMilestoneName - Nombre del siguiente hito (opcional)
   * @returns true si se envió exitosamente
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
   * Envía notificación de que un hito fue rechazado (ÚLTIMO EMAIL, termina proceso).
   * Usa plantilla 'MILESTONE_REJECTED' de BD.
   * 
   * Variables: applicant_name, call_name, milestone_name
   * 
   * @param email - Email del postulante
   * @param applicantName - Nombre del postulante
   * @param callName - Nombre de la convocatoria
   * @param milestoneName - Nombre del hito rechazado
   * @returns true si se envió exitosamente
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
   * Envía email de bienvenida al sistema.
   * Usa plantilla 'WELCOME' de BD.
   * 
   * Variables: applicant_name, dashboard_link
   * 
   * @param email - Email del postulante
   * @param applicantName - Nombre del postulante
   * @returns true si se envió exitosamente
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
