import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PasswordChangeToken } from './entities/password-change-token.entity';
import { User } from './entities/user.entity';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { EmailTemplateHelper } from '../email/email-template.helper';

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

      const content = `
        ${EmailTemplateHelper.greeting(fullName)}
        ${EmailTemplateHelper.paragraph('Has solicitado cambiar tu contraseña en el Sistema de Gestión de la Fundación Carmen Goudie.')}
        ${EmailTemplateHelper.paragraph('Para establecer una nueva contraseña, haz clic en el siguiente botón:')}
        ${EmailTemplateHelper.button('Cambiar Mi Contraseña', changePasswordUrl)}
        ${EmailTemplateHelper.linkFallback(changePasswordUrl)}
        ${EmailTemplateHelper.warningNote('Importante', `
          <ul style="margin: 5px 0; padding-left: 20px;">
            <li>Este enlace expirará en <strong>1 hora</strong></li>
            <li>Solo puede ser utilizado <strong>una vez</strong></li>
            <li>Si no solicitaste este cambio, ignora este email</li>
          </ul>
        `)}
        ${EmailTemplateHelper.paragraph('<span style="color: #6b7280; font-size: 14px;">Si no solicitaste cambiar tu contraseña, tu cuenta está segura y puedes ignorar este mensaje.</span>')}
      `;

      const html = EmailTemplateHelper.wrapEmail(content);

      await this.emailService.sendEmail({
        to: userEmail,
        subject,
        htmlContent: html,
      });

      this.logger.log(`Email de cambio de contraseña enviado a ${userEmail}`);
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
