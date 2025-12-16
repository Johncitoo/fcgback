import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Admin2FACode } from './entities/admin-2fa-code.entity';
import { ConfigService } from '@nestjs/config';

/**
 * Servicio para gestión de códigos 2FA en operaciones administrativas.
 * 
 * Flujo de uso:
 * 1. Admin solicita crear usuario → requestCode()
 * 2. Sistema genera código de 6 dígitos
 * 3. Código se envía al email del admin (no al usuario nuevo)
 * 4. Admin ingresa código → validateAndConsume()
 * 5. Si válido, se marca como usado y se permite la operación
 * 
 * Características de seguridad:
 * - Códigos expiran en 10 minutos
 * - Solo se pueden usar una vez
 * - Limpieza automática de códigos expirados
 */
@Injectable()
export class Admin2FAService {
  private readonly logger = new Logger(Admin2FAService.name);

  constructor(
    @InjectRepository(Admin2FACode)
    private codeRepo: Repository<Admin2FACode>,
    private configService: ConfigService,
  ) {}

  /**
   * Genera un código numérico de 6 dígitos.
   * 
   * @returns Código de 6 dígitos como string (ej: "123456")
   */
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Solicita un código 2FA para una operación administrativa.
   * 
   * @param adminEmail - Email del admin que solicita el código
   * @param purpose - Propósito del código (ej: 'CREATE_USER')
   * @param metadata - Datos adicionales a guardar (ej: info del usuario a crear)
   * @returns Código generado y fecha de expiración
   * 
   * @example
   * const result = await requestCode(
   *   'admin@example.com',
   *   'CREATE_USER',
   *   { email: 'nuevo@example.com', fullName: 'Juan Pérez', role: 'REVIEWER' }
   * );
   * // result = { code: '123456', expiresAt: Date }
   */
  async requestCode(
    adminEmail: string,
    purpose: string,
    metadata?: any,
  ): Promise<{ code: string; expiresAt: Date }> {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    const codeEntity = this.codeRepo.create({
      adminEmail,
      code,
      purpose,
      metadata,
      expiresAt,
      used: false,
      usedAt: null,
    });

    await this.codeRepo.save(codeEntity);

    this.logger.log(
      `Código 2FA generado para ${adminEmail} (propósito: ${purpose})`,
    );

    return { code, expiresAt };
  }

  /**
   * Valida y consume un código 2FA.
   * 
   * Verifica que:
   * - El código existe
   * - Pertenece al admin correcto
   * - Es para el propósito correcto
   * - No ha sido usado
   * - No ha expirado
   * 
   * Si todo es válido, marca el código como usado.
   * 
   * @param adminEmail - Email del admin que ingresa el código
   * @param code - Código de 6 dígitos ingresado
   * @param purpose - Propósito esperado
   * @returns Entidad del código con metadata, o null si inválido
   * 
   * @example
   * const codeEntity = await validateAndConsume(
   *   'admin@example.com',
   *   '123456',
   *   'CREATE_USER'
   * );
   * if (codeEntity) {
   *   const userData = codeEntity.metadata;
   *   // Proceder a crear usuario
   * }
   */
  async validateAndConsume(
    adminEmail: string,
    code: string,
    purpose: string,
  ): Promise<Admin2FACode | null> {
    const codeEntity = await this.codeRepo.findOne({
      where: {
        adminEmail,
        code,
        purpose,
        used: false,
      },
    });

    if (!codeEntity) {
      this.logger.warn(
        `Código 2FA inválido o ya usado para ${adminEmail} (propósito: ${purpose})`,
      );
      return null;
    }

    // Verificar expiración
    if (new Date() > codeEntity.expiresAt) {
      this.logger.warn(
        `Código 2FA expirado para ${adminEmail} (propósito: ${purpose})`,
      );
      return null;
    }

    // Marcar como usado
    codeEntity.used = true;
    codeEntity.usedAt = new Date();
    await this.codeRepo.save(codeEntity);

    this.logger.log(
      `Código 2FA consumido exitosamente para ${adminEmail} (propósito: ${purpose})`,
    );

    return codeEntity;
  }

  /**
   * Limpia códigos expirados o usados de hace más de 24 horas.
   * 
   * Debe ejecutarse periódicamente (ej: cron job diario).
   */
  async cleanupExpiredCodes(): Promise<number> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await this.codeRepo.delete({
      expiresAt: LessThan(oneDayAgo),
    });

    const count = result.affected || 0;
    if (count > 0) {
      this.logger.log(`Limpiados ${count} códigos 2FA expirados`);
    }

    return count;
  }
}
