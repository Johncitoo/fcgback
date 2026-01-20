import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewerVerificationCode } from './entities/reviewer-verification-code.entity';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { EmailTemplateHelper } from '../email/email-template.helper';

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
    const passwordHash = await bcrypt.hash(password, 10);

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
      
      const content = `
        ${EmailTemplateHelper.greeting()}
        ${EmailTemplateHelper.paragraph('Has solicitado crear un nuevo usuario revisor con el siguiente email:')}
        ${EmailTemplateHelper.infoNote(`<strong>${newReviewerEmail}</strong>`)}
        ${EmailTemplateHelper.paragraph('Para confirmar esta acción, ingresa el siguiente código de verificación:')}
        ${EmailTemplateHelper.codeBox('Código de verificación', code)}
        ${EmailTemplateHelper.warningNote('Importante', 'Este código expira en <strong>10 minutos</strong>.')}
        ${EmailTemplateHelper.paragraph('<span style="color: #6b7280; font-size: 14px;">Si no solicitaste esta acción, ignora este email. El código expirará automáticamente.</span>')}
      `;

      const html = EmailTemplateHelper.wrapEmail(content);

      await this.emailService.sendEmail({
        to: adminEmail,
        subject,
        htmlContent: html,
      });

      this.logger.log(`Email enviado a ${adminEmail} con código de verificación`);
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
    const passwordHash = await bcrypt.hash(tempPassword, 10);

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
      const loginUrl = `${frontendUrl}/auth/login`;
      const subject = 'Bienvenido al Sistema de Gestión - Fundación Carmen Goudie';
      
      const content = `
        ${EmailTemplateHelper.greeting(fullName)}
        ${EmailTemplateHelper.paragraph('Te damos la bienvenida al Sistema de Gestión de la Fundación Carmen Goudie. Has sido agregado como <strong>Revisor</strong>.')}
        ${EmailTemplateHelper.credentialsBox(reviewerEmail, tempPassword)}
        ${EmailTemplateHelper.warningNote('Seguridad', 'Por tu seguridad, te recomendamos <strong>cambiar esta contraseña</strong> tan pronto como inicies sesión. Puedes hacerlo desde tu perfil en la opción "Cambiar Contraseña".')}
        ${EmailTemplateHelper.button('Iniciar Sesión', loginUrl)}
        ${EmailTemplateHelper.paragraph('<span style="color: #6b7280; font-size: 14px;">Si tienes alguna pregunta o necesitas ayuda, no dudes en contactar al administrador del sistema.</span>')}
      `;

      const html = EmailTemplateHelper.wrapEmail(content);

      await this.emailService.sendEmail({
        to: reviewerEmail,
        subject,
        htmlContent: html,
      });

      this.logger.log(`Email de bienvenida enviado a ${reviewerEmail}`);
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
