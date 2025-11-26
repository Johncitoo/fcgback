import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendEmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly brevoApiKey: string;
  private readonly brevoApiUrl = 'https://api.brevo.com/v3/smtp/email';
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private readonly config: ConfigService) {
    this.brevoApiKey = this.config.get<string>('BREVO_API_KEY') || '';
    this.fromEmail = this.config.get<string>('EMAIL_FROM') || 'noreply@fcg.cl';
    this.fromName = this.config.get<string>('EMAIL_FROM_NAME') || 'Fundación Carmen Goudie';
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    // Si no hay API key configurada, solo loguear (modo desarrollo)
    if (!this.brevoApiKey) {
      this.logger.warn('BREVO_API_KEY no configurada. Email no enviado (modo desarrollo)');
      this.logger.log(`Email simulado a: ${options.to}`);
      this.logger.log(`Asunto: ${options.subject}`);
      return true;
    }

    try {
      const response = await fetch(this.brevoApiUrl, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': this.brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: this.fromName,
            email: this.fromEmail,
          },
          to: [{ email: options.to }],
          subject: options.subject,
          htmlContent: options.htmlContent,
          textContent: options.textContent || options.htmlContent.replace(/<[^>]*>/g, ''),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Error al enviar email: ${errorText}`);
        return false;
      }

      this.logger.log(`Email enviado exitosamente a: ${options.to}`);
      return true;
    } catch (error) {
      this.logger.error(`Error al enviar email: ${error}`);
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

    return this.sendEmail({
      to: email,
      subject,
      htmlContent,
    });
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

    return this.sendEmail({
      to: email,
      subject,
      htmlContent,
    });
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

    return this.sendEmail({
      to: email,
      subject,
      htmlContent,
    });
  }
}
