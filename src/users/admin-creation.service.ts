import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminVerificationCode } from './entities/admin-verification-code.entity';
import { User } from './entities/user.entity';
import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';

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
  ): Promise<{ id: string }> {
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

    return { id: verification.id };
  }

  /**
   * Envía email con código de verificación al admin solicitante.
   * 
   * TODO: Integrar con servicio de emails (Brevo).
   * Por ahora solo registra en logs.
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
    // TODO: Integrar con servicio de emails existente
    // Por ahora solo log para desarrollo
    this.logger.warn(
      `[DESARROLLO] Código de verificación para ${adminEmail}: ${code}`,
    );
    this.logger.warn(
      `Email a enviar: "Tu código para crear admin ${newAdminEmail} es: ${code}. Expira en 10 minutos."`,
    );

    // En producción, usar el servicio de emails:
    // await this.emailService.sendAdminVerificationCode(adminEmail, code, newAdminEmail);
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
  async confirmAndCreateAdmin(
    requesterId: string,
    code: string,
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
