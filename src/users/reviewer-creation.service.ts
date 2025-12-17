import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewerVerificationCode } from './entities/reviewer-verification-code.entity';
import { User } from './entities/user.entity';
import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';

@Injectable()
export class ReviewerCreationService {
  private readonly logger = new Logger(ReviewerCreationService.name);

  constructor(
    @InjectRepository(ReviewerVerificationCode)
    private readonly verificationRepo: Repository<ReviewerVerificationCode>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  private generateSixDigitCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async createVerificationRequest(
    requesterId: string,
    email: string,
    fullName: string,
    password: string,
  ): Promise<{ id: string; tempPassword: string }> {
    const code = this.generateSixDigitCode();
    const passwordHash = await argon2.hash(password);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    const verification = this.verificationRepo.create({
      code,
      requesterUserId: requesterId,
      pendingEmail: email.toLowerCase().trim(),
      pendingFullName: fullName.trim(),
      pendingPasswordHash: passwordHash,
      used: false,
      expiresAt,
    });

    await this.verificationRepo.save(verification);

    const requester = await this.userRepo.findOne({
      where: { id: requesterId },
    });

    if (requester) {
      await this.sendVerificationEmail(requester.email, code, email);
    }

    this.logger.log(
      `Código de verificación creado para reviewer ${email} por admin ${requesterId}`,
    );

    return { id: verification.id, tempPassword: password };
  }

  private async sendVerificationEmail(
    adminEmail: string,
    code: string,
    newReviewerEmail: string,
  ): Promise<void> {
    try {
      const subject = 'Código de verificación - Creación de revisor';
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
            .code-box { background: white; border: 2px solid #7c3aed; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
            .code { font-size: 32px; font-weight: bold; color: #7c3aed; letter-spacing: 8px; font-family: monospace; }
            .info { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">🔐 Código de Verificación</h1>
            </div>
            <div class="content">
              <p>Hola,</p>
              <p>Has solicitado crear un nuevo usuario revisor con el siguiente email:</p>
              <p style="font-weight: bold; color: #7c3aed; font-size: 16px;">📧 ${newReviewerEmail}</p>
              
              <p>Para confirmar esta acción, ingresa el siguiente código de verificación:</p>
              
              <div class="code-box">
                <div class="code">${code}</div>
              </div>
              
              <div class="info">
                <strong>⏱️ Importante:</strong> Este código expira en <strong>10 minutos</strong>.
              </div>
              
              <p style="color: #64748b; font-size: 14px;">
                Si no solicitaste esta acción, ignora este email. El código expirará automáticamente.
              </p>
            </div>
            <div class="footer">
              <p>Fundación Carmen Goudie - Sistema de Gestión</p>
              <p style="font-size: 12px;">Este es un email automático, por favor no responder.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.emailService.sendEmail({
        to: adminEmail,
        subject,
        htmlContent: html,
      });

      this.logger.log(`✅ Email enviado a ${adminEmail} con código de verificación`);
    } catch (error) {
      this.logger.error(`Error enviando email de verificación:`, error);
    }
  }

  async confirmAndCreateReviewer(
    requesterId: string,
    code: string,
  ): Promise<{ user: User; tempPassword: string }> {
    const verification = await this.verificationRepo.findOne({
      where: {
        code,
        requesterUserId: requesterId,
        used: false,
      },
    });

    if (!verification) {
      throw new BadRequestException(
        'Código de verificación inválido o ya fue utilizado',
      );
    }

    if (verification.expiresAt < new Date()) {
      throw new BadRequestException(
        'El código de verificación ha expirado. Solicita uno nuevo.',
      );
    }

    // Generar contraseña temporal para enviar en el email de bienvenida
    const tempPassword = this.generateTemporaryPassword();
    const passwordHash = await argon2.hash(tempPassword);

    const newReviewer = this.userRepo.create({
      email: verification.pendingEmail,
      passwordHash,
      fullName: verification.pendingFullName,
      role: 'REVIEWER',
      isActive: true,
      applicantId: null,
    });

    await this.userRepo.save(newReviewer);

    verification.used = true;
    await this.verificationRepo.save(verification);

    // Enviar email de bienvenida con credenciales
    await this.sendWelcomeEmail(
      newReviewer.email,
      newReviewer.fullName,
      tempPassword,
    );

    this.logger.log(
      `Nuevo reviewer creado: ${newReviewer.email} (ID: ${newReviewer.id})`,
    );

    return { user: newReviewer, tempPassword };
  }

  private generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const special = '!@#$%';
    let password = '';
    
    for (let i = 0; i < 12; i++) {
      if (i === 6) {
        password += special[Math.floor(Math.random() * special.length)];
      } else {
        password += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    
    return password;
  }

  private async sendWelcomeEmail(
    reviewerEmail: string,
    fullName: string,
    tempPassword: string,
  ): Promise<void> {
    try {
      const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'https://fundacioncarmengoudie.cl';
      const subject = '¡Bienvenido al Sistema de Gestión!';
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
            .credentials-box { background: white; border: 2px solid #7c3aed; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .credential-item { margin: 10px 0; padding: 10px; background: #f1f5f9; border-radius: 4px; }
            .credential-label { font-weight: bold; color: #64748b; font-size: 12px; text-transform: uppercase; }
            .credential-value { font-size: 16px; color: #1e293b; font-family: monospace; margin-top: 5px; }
            .warning { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .button { display: inline-block; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">🎉 ¡Bienvenido!</h1>
            </div>
            <div class="content">
              <p>Hola <strong>${fullName}</strong>,</p>
              <p>Te damos la bienvenida al Sistema de Gestión de la Fundación Carmen Goudie. Has sido agregado como <strong>Revisor</strong>.</p>
              
              <div class="credentials-box">
                <h3 style="margin-top: 0; color: #7c3aed;">🔑 Tus credenciales de acceso:</h3>
                
                <div class="credential-item">
                  <div class="credential-label">Usuario / Email</div>
                  <div class="credential-value">${reviewerEmail}</div>
                </div>
                
                <div class="credential-item">
                  <div class="credential-label">Contraseña Temporal</div>
                  <div class="credential-value">${tempPassword}</div>
                </div>
              </div>
              
              <div class="warning">
                <strong>🔒 Seguridad Importante:</strong><br>
                Por tu seguridad, te recomendamos <strong>cambiar esta contraseña</strong> tan pronto como inicies sesión. 
                Puedes hacerlo desde tu perfil en la opción "Cambiar Contraseña".
              </div>
              
              <div style="text-align: center;">
                <a href="${frontendUrl}/auth/login" class="button">Iniciar Sesión Ahora</a>
              </div>
              
              <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
                Si tienes alguna pregunta o necesitas ayuda, no dudes en contactar al administrador del sistema.
              </p>
            </div>
            <div class="footer">
              <p>Fundación Carmen Goudie - Sistema de Gestión</p>
              <p style="font-size: 12px;">Este es un email automático, por favor no responder.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.emailService.sendEmail({
        to: reviewerEmail,
        subject,
        htmlContent: html,
      });

      this.logger.log(`✅ Email de bienvenida enviado a ${reviewerEmail}`);
    } catch (error) {
      this.logger.error(`Error enviando email de bienvenida:`, error);
    }
  }

  async cleanExpiredCodes(): Promise<number> {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const result = await this.verificationRepo
      .createQueryBuilder()
      .delete()
      .where('expires_at < :date', { date: oneHourAgo })
      .execute();

    this.logger.log(`Limpieza: ${result.affected} códigos de reviewer expirados eliminados`);
    return result.affected || 0;
  }
}
