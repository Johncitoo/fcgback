import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/**
 * Entidad para códigos de verificación 2FA en operaciones administrativas.
 * 
 * Se usa cuando un ADMIN crea otro usuario ADMIN/REVIEWER.
 * El código se envía al email del admin que está creando el usuario.
 * 
 * Características:
 * - Código de 6 dígitos numéricos
 * - Expira en 10 minutos
 * - Solo se puede usar una vez
 * - Guarda metadata con los datos del usuario a crear
 */
@Entity('admin_2fa_codes')
@Index(['adminEmail', 'code'])
export class Admin2FACode {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }

  /**
   * Email del admin que está realizando la acción
   * (NO el email del usuario que se va a crear)
   */
  @Column({ type: 'text', name: 'admin_email' })
  @Index()
  adminEmail: string;

  /**
   * Código de verificación de 6 dígitos
   */
  @Column({ length: 6 })
  @Index()
  code: string;

  /**
   * Propósito del código (ej: 'CREATE_USER')
   */
  @Column({ length: 50 })
  purpose: string;

  /**
   * Datos adicionales guardados temporalmente
   * Para CREATE_USER: { email, fullName, role, password }
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  /**
   * Indica si el código ya fue utilizado
   */
  @Column({ default: false })
  used: boolean;

  /**
   * Fecha/hora en que se usó el código
   */
  @Column({ type: 'timestamptz', nullable: true, name: 'used_at' })
  usedAt: Date | null;

  /**
   * Fecha/hora de expiración (10 minutos después de creación)
   */
  @Column({ type: 'timestamptz', name: 'expires_at' })
  @Index()
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
