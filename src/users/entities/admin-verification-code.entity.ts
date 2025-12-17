import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Entity para códigos de verificación 2FA al crear usuarios admin.
 * 
 * Flujo:
 * 1. Admin solicita crear nuevo admin
 * 2. Sistema genera código de 6 dígitos
 * 3. Guarda código temporal con datos del nuevo admin
 * 4. Envía email con código al admin solicitante
 * 5. Admin confirma con código
 * 6. Sistema crea usuario y marca código como usado
 * 
 * Seguridad:
 * - Códigos expiran en 10 minutos
 * - Solo 1 uso por código
 * - Asociados al admin solicitante (no reutilizables)
 */
@Entity('admin_verification_codes')
export class AdminVerificationCode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 6 })
  code!: string;

  @Index()
  @Column({ type: 'uuid', name: 'requester_user_id' })
  requesterUserId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requester_user_id' })
  requesterUser!: User;

  @Column({ type: 'citext', name: 'pending_email' })
  pendingEmail!: string;

  @Column({ type: 'text', name: 'pending_full_name' })
  pendingFullName!: string;

  @Column({ type: 'text', name: 'pending_password_hash' })
  pendingPasswordHash!: string;

  @Column({ type: 'boolean', default: false })
  used!: boolean;

  @Index()
  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
