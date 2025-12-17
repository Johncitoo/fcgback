import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PasswordChangeToken } from './entities/password-change-token.entity';
import { User } from './entities/user.entity';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';

@Injectable()
export class PasswordChangeService {
  private readonly logger = new Logger(PasswordChangeService.name);

  constructor(
    @InjectRepository(PasswordChangeToken)
    private readonly tokenRepo: Repository<PasswordChangeToken>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async requestPasswordChange(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    // Generar token único
    const token = uuidv4();

    // Expiración en 1 hora
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Crear registro de token
    const passwordToken = this.tokenRepo.create({
      userId,
      token,
      used: false,
      expiresAt,
    });

    await this.tokenRepo.save(passwordToken);

    // Enviar email con el link
    await this.sendPasswordChangeEmail(user.email, user.fullName, token);

    this.logger.log(`Token de cambio de contraseña creado para ${user.email}`);
  }

  private async sendPasswordChangeEmail(
    userEmail: string,
    fullName: string,
    token: string,
  ): Promise<void> {
    try {
      const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'https://fcgfront.vercel.app';
      const changePasswordUrl = `${frontendUrl}/auth/reset-password?token=${token}`;
      const subject = 'Cambio de Contraseña - Fundación Carmen Goudie';

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
            .button { display: inline-block; padding: 14px 28px; background: #7c3aed; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            .button:hover { background: #6d28d9; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .info { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">🔐 Cambio de Contraseña</h1>
            </div>
            <div class="content">
              <p>Hola <strong>${fullName}</strong>,</p>
              <p>Has solicitado cambiar tu contraseña en el Sistema de Gestión de la Fundación Carmen Goudie.</p>
              
              <p>Para establecer una nueva contraseña, haz clic en el siguiente botón:</p>
              
              <div style="text-align: center;">
                <a href="${changePasswordUrl}" class="button">Cambiar Mi Contraseña</a>
              </div>
              
              <div class="info">
                <strong>🔗 O copia este enlace en tu navegador:</strong><br>
                <a href="${changePasswordUrl}" style="color: #3b82f6; word-break: break-all;">${changePasswordUrl}</a>
              </div>
              
              <div class="warning">
                <strong>⏱️ Importante:</strong><br>
                • Este enlace expirará en <strong>1 hora</strong><br>
                • Solo puede ser utilizado <strong>una vez</strong><br>
                • Si no solicitaste este cambio, ignora este email
              </div>
              
              <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
                Si no solicitaste cambiar tu contraseña, tu cuenta está segura y puedes ignorar este mensaje.
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
        to: userEmail,
        subject,
        htmlContent: html,
      });

      this.logger.log(`✅ Email de cambio de contraseña enviado a ${userEmail}`);
    } catch (error) {
      this.logger.error(`Error enviando email de cambio de contraseña:`, error);
      throw new BadRequestException('Error al enviar el email');
    }
  }

  async validateToken(token: string): Promise<{ valid: boolean; message?: string }> {
    const passwordToken = await this.tokenRepo.findOne({
      where: { token },
    });

    if (!passwordToken) {
      return { valid: false, message: 'El enlace no es válido' };
    }

    if (passwordToken.used) {
      return { valid: false, message: 'Este enlace ya fue utilizado' };
    }

    if (passwordToken.isExpired()) {
      return { valid: false, message: 'Este enlace ha expirado' };
    }

    return { valid: true };
  }

  async changePasswordWithToken(token: string, newPassword: string): Promise<void> {
    const passwordToken = await this.tokenRepo.findOne({
      where: { token },
      relations: ['user'],
    });

    if (!passwordToken) {
      throw new BadRequestException('Token inválido');
    }

    if (passwordToken.used) {
      throw new BadRequestException('Este enlace ya fue utilizado');
    }

    if (passwordToken.isExpired()) {
      throw new BadRequestException('Este enlace ha expirado. Solicita uno nuevo.');
    }

    // Hash de la nueva contraseña
    const passwordHash = await argon2.hash(newPassword);

    // Actualizar contraseña del usuario
    await this.userRepo.update(passwordToken.userId, { passwordHash });

    // Marcar el token como usado
    passwordToken.used = true;
    await this.tokenRepo.save(passwordToken);

    this.logger.log(`Contraseña cambiada exitosamente para usuario ${passwordToken.userId}`);
  }

  async cleanExpiredTokens(): Promise<number> {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const result = await this.tokenRepo
      .createQueryBuilder()
      .delete()
      .where('expires_at < :date', { date: oneDayAgo })
      .execute();

    this.logger.log(`Limpieza: ${result.affected} tokens de cambio de contraseña expirados eliminados`);
    return result.affected || 0;
  }
}
