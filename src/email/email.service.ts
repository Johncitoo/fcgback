import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
  private dailyEmailCount1: number = 0;
  
  // Account 2 - Mass emails
  private readonly brevoApiKey2: string;
  private readonly fromEmail2: string;
  private readonly fromName2: string;
  private dailyEmailCount2: number = 0;
  
  // Shared configuration
  private lastResetDate: string = this.getTodayDate();
  private readonly DAILY_LIMIT = 300; // Límite por cuenta

  constructor(private readonly config: ConfigService) {
    // Account 1 - Transactional
    this.brevoApiKey1 = this.config.get<string>('BREVO_API_KEY_1') || this.config.get<string>('BREVO_API_KEY') || '';
    this.fromEmail1 = this.config.get<string>('EMAIL_FROM_1') || this.config.get<string>('EMAIL_FROM') || 'noreply@fcg.cl';
    this.fromName1 = this.config.get<string>('EMAIL_FROM_NAME_1') || this.config.get<string>('EMAIL_FROM_NAME') || 'Fundación Carmen Goudie';
    
    // Account 2 - Mass
    this.brevoApiKey2 = this.config.get<string>('BREVO_API_KEY_2') || '';
    this.fromEmail2 = this.config.get<string>('EMAIL_FROM_2') || this.fromEmail1;
    this.fromName2 = this.config.get<string>('EMAIL_FROM_NAME_2') || this.fromName1;
    
    // Verificar y resetear contadores si es necesario
    this.checkAndResetCounter();
    
    this.logger.log('📧 Email Service inicializado con 2 cuentas Brevo');
  }
  
  /**
   * Obtiene la fecha actual en formato YYYY-MM-DD
   */
  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }
  
  /**
   * Verifica si es un nuevo día y resetea los contadores si es necesario
   */
  private checkAndResetCounter(): void {
    const today = this.getTodayDate();
    if (today !== this.lastResetDate) {
      this.logger.log(`📧 Nuevo día detectado. Reseteando contadores (Cuenta 1: ${this.dailyEmailCount1}, Cuenta 2: ${this.dailyEmailCount2})`);
      this.dailyEmailCount1 = 0;
      this.dailyEmailCount2 = 0;
      this.lastResetDate = today;
    }
  }
  
  /**
   * Obtiene el estado de ambas cuentas de email
   */
  async getDualQuotaStatus(): Promise<DualEmailQuotaStatus> {
    this.checkAndResetCounter();
    
    // Calcular cuándo se resetea (mañana a las 00:00 UTC)
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    
    const account1 = {
      name: 'Transaccional',
      used: this.dailyEmailCount1,
      limit: this.DAILY_LIMIT,
      remaining: Math.max(0, this.DAILY_LIMIT - this.dailyEmailCount1),
      percentage: Math.round((this.dailyEmailCount1 / this.DAILY_LIMIT) * 100),
      resetAt: tomorrow,
    };
    
    const account2 = {
      name: 'Masivos',
      used: this.dailyEmailCount2,
      limit: this.DAILY_LIMIT,
      remaining: Math.max(0, this.DAILY_LIMIT - this.dailyEmailCount2),
      percentage: Math.round((this.dailyEmailCount2 / this.DAILY_LIMIT) * 100),
      resetAt: tomorrow,
    };
    
    const totalUsed = this.dailyEmailCount1 + this.dailyEmailCount2;
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
   * Incrementa el contador de emails enviados según la categoría
   */
  private incrementCounter(category: EmailCategory): void {
    if (category === EmailCategory.TRANSACTIONAL) {
      this.dailyEmailCount1++;
      this.logger.log(`📊 [Cuenta 1] Emails enviados hoy: ${this.dailyEmailCount1}/${this.DAILY_LIMIT}`);
    } else {
      this.dailyEmailCount2++;
      this.logger.log(`📊 [Cuenta 2] Emails enviados hoy: ${this.dailyEmailCount2}/${this.DAILY_LIMIT}`);
    }
  }

  async sendEmail(options: SendEmailOptions, category: EmailCategory = EmailCategory.TRANSACTIONAL): Promise<boolean> {
    // Verificar y resetear contadores si es un nuevo día
    this.checkAndResetCounter();
    
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
      this.incrementCounter(category);
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

      this.incrementCounter(category);
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
}
