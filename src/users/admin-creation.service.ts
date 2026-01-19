import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminVerificationCode } from './entities/admin-verification-code.entity';
import { User } from './entities/user.entity';
import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { AuditService } from '../common/audit.service';
import { EmailTemplateHelper } from '../email/email-template.helper';

/**
 * Servicio para gestionar creación de usuarios admin con verificación 2FA.
 * 
 * Maneja el flujo completo:
 * 1. Generación de código aleatorio de 6 dígitos
 * 2. Hash de contraseña con argon2
 * 3. Almacenamiento temporal del código
 * 4. Envío de email con código
 * 5. Validación de código
 * 6. Creación de usuario admin
 * 
 * Seguridad:
 * - Códigos expiran en 10 minutos
 * - Solo 1 uso por código
 * - Asociados al admin solicitante
 * - Contraseñas hasheadas con argon2
 */
@Injectable()
export class AdminCreationService {
  private readonly logger = new Logger(AdminCreationService.name);

  constructor(
    @InjectRepository(AdminVerificationCode)
    private readonly verificationRepo: Repository<AdminVerificationCode>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Genera código aleatorio de 6 dígitos numéricos.
   * 
   * @returns String de 6 dígitos (ej: "542891")
   */
  private generateSixDigitCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Crea solicitud de verificación para nuevo admin.
   * 
   * Genera código, hashea contraseña, guarda temporalmente y envía email.
   * 
   * @param requesterId - UUID del admin que solicita crear nuevo admin
   * @param email - Email del nuevo admin
   * @param fullName - Nombre completo del nuevo admin
   * @param password - Contraseña en texto plano (será hasheada)
   * @returns Objeto con id de la solicitud creada
   * @throws BadRequestException si falla el hash o guardado
   */
  async createVerificationRequest(
    requesterId: string,
    email: string,
    fullName: string,
    password: string,
  ): Promise<{ id: string; tempPassword: string }> {
    // Generar código de 6 dígitos
    const code = this.generateSixDigitCode();

    // Hashear contraseña
    const passwordHash = await argon2.hash(password);

    // Crear registro temporal con expiración en 10 minutos
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

    // Obtener email del solicitante para enviar código
    const requester = await this.userRepo.findOne({
      where: { id: requesterId },
    });

    if (requester) {
      await this.sendVerificationEmail(requester.email, code, email);
    }

    this.logger.log(
      `Código de verificación creado para ${email} por admin ${requesterId}`,
    );

    return { id: verification.id, tempPassword: password };
  }

  /**
   * Envía email con código de verificación al admin solicitante.
   * 
   * Usa EmailService integrado con Brevo para envío real.
   * 
   * @param adminEmail - Email del admin solicitante
   * @param code - Código de 6 dígitos
   * @param newAdminEmail - Email del nuevo admin a crear
   */
  private async sendVerificationEmail(
    adminEmail: string,
    code: string,
    newAdminEmail: string,
  ): Promise<void> {
    try {
      const subject = 'Código de verificación - Creación de administrador';
      
      const content = `
        ${EmailTemplateHelper.greeting()}
        ${EmailTemplateHelper.paragraph('Has solicitado crear un nuevo usuario administrador con el siguiente email:')}
        ${EmailTemplateHelper.infoNote(`<strong>${newAdminEmail}</strong>`)}
        ${EmailTemplateHelper.paragraph('Para confirmar esta acción, ingresa el siguiente código de verificación:')}
        ${EmailTemplateHelper.codeBox('Código de verificación', code)}
        ${EmailTemplateHelper.warningNote('Importante', 'Este código expira en <strong>10 minutos</strong>.')}
        ${EmailTemplateHelper.paragraph('<span style="color: #6b7280; font-size: 14px;">Si no solicitaste esta acción, ignora este email. El código expirará automáticamente.</span>')}
      `;

      const html = EmailTemplateHelper.wrapEmail(content);

      const sent = await this.emailService.sendEmail({
        to: adminEmail,
        subject,
        htmlContent: html,
      });

      if (sent) {
        this.logger.log(`Email enviado a ${adminEmail} con código de verificación`);
      } else {
        this.logger.error(`Fallo al enviar email a ${adminEmail}`);
      }
    } catch (error) {
      this.logger.error(`Error enviando email de verificación:`, error);
      // No lanzar excepción para no bloquear el flujo
      // El código sigue siendo válido aunque falle el email
    }
  }

  /**
   * Valida código y crea usuario admin.
   * 
   * Busca código no usado, verifica expiración, valida solicitante,
   * crea usuario admin y marca código como usado.
   * 
   * @param requesterId - UUID del admin que confirma
   * @param code - Código de 6 dígitos
   * @returns Usuario admin creado
   * @throws BadRequestException si código inválido, expirado o ya usado
   */
  private async sendWelcomeEmail(
    adminEmail: string,
    fullName: string,
    tempPassword: string,
  ): Promise<void> {
    try {
      const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'https://fcgfront.vercel.app';
      const loginUrl = `${frontendUrl}/auth/login`;
      const subject = 'Bienvenido al Sistema de Gestión - Fundación Carmen Goudie';

      const content = `
        ${EmailTemplateHelper.greeting(fullName)}
        ${EmailTemplateHelper.successNote('Se ha creado exitosamente tu cuenta de <strong>administrador</strong> en el Sistema de Gestión de la Fundación Carmen Goudie.')}
        ${EmailTemplateHelper.credentialsBox(adminEmail, tempPassword)}
        ${EmailTemplateHelper.warningNote('Seguridad', `
          <ul style="margin: 5px 0; padding-left: 20px;">
            <li>Cambia tu contraseña después del primer inicio de sesión</li>
            <li>No compartas tus credenciales con nadie</li>
            <li>Usa una contraseña segura con letras, números y símbolos</li>
          </ul>
        `)}
        ${EmailTemplateHelper.button('Iniciar Sesión', loginUrl)}
        ${EmailTemplateHelper.paragraph('<span style="color: #6b7280; font-size: 14px;">Si tienes alguna pregunta o necesitas ayuda, contacta al administrador del sistema.</span>')}
      `;

      const html = EmailTemplateHelper.wrapEmail(content);

      await this.emailService.sendEmail({
        to: adminEmail,
        subject,
        htmlContent: html,
      });

      this.logger.log(`Email de bienvenida enviado a ${adminEmail}`);
    } catch (error) {
      this.logger.error(`Error enviando email de bienvenida:`, error);
    }
  }

  async confirmAndCreateAdmin(
    requesterId: string,
    code: string,
    tempPassword: string,
  ): Promise<User> {
    // Buscar código no usado del solicitante
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

    // Verificar que no haya expirado
    if (verification.expiresAt < new Date()) {
      throw new BadRequestException(
        'El código de verificación ha expirado. Solicita uno nuevo.',
      );
    }

    // Crear usuario admin
    const newAdmin = this.userRepo.create({
      email: verification.pendingEmail,
      passwordHash: verification.pendingPasswordHash,
      fullName: verification.pendingFullName,
      role: 'ADMIN',
      isActive: true,
      applicantId: null,
    });

    await this.userRepo.save(newAdmin);

    // Marcar código como usado
    verification.used = true;
    await this.verificationRepo.save(verification);

    // Registrar creación en auditoría
    await this.auditService.logUserCreated(
      newAdmin.id,
      'ADMIN',
      newAdmin.email,
      requesterId, // El admin que solicitó la creación
    );

    // Enviar email de bienvenida con credenciales
    await this.sendWelcomeEmail(
      newAdmin.email,
      newAdmin.fullName,
      tempPassword,
    );

    this.logger.log(
      `Nuevo admin creado: ${newAdmin.email} (ID: ${newAdmin.id})`,
    );

    return newAdmin;
  }

  /**
   * Limpia códigos expirados (puede ejecutarse en cron job).
   * 
   * Elimina códigos que expiraron hace más de 1 hora.
   * 
   * @returns Número de códigos eliminados
   */
  async cleanExpiredCodes(): Promise<number> {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const result = await this.verificationRepo
      .createQueryBuilder()
      .delete()
      .where('expires_at < :date', { date: oneHourAgo })
      .execute();

    this.logger.log(`Limpieza: ${result.affected} códigos expirados eliminados`);
    return result.affected || 0;
  }
}
