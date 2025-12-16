import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/entities/user.entity';

/**
 * Entidad de invitación para el sistema de onboarding.
 * 
 * Gestiona códigos de invitación únicos que permiten a los postulantes
 * acceder al sistema y completar su aplicación.
 * 
 * Campos clave:
 * - codeHash: Hash del código de invitación (nunca se almacena en claro)
 * - emailSent: Indica si se envió el email con el código
 * - sentAt: Timestamp del envío del email
 * - meta: Metadata JSON con firstName, lastName, email del postulante
 * 
 * El código se verifica usando argon2.verify() contra codeHash
 */
@Entity('invites')
export class Invite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'call_id' })
  callId: string;

  @Column({ name: 'institution_id', type: 'uuid', nullable: true })
  institutionId: string | null;

  @Column({ name: 'code_hash', unique: true })
  codeHash: string;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'used_by_applicant', type: 'uuid', nullable: true })
  usedByApplicant: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'used_by_applicant' })
  user?: User | null;

  @Column({ name: 'used_at', type: 'timestamp', nullable: true })
  usedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, any> | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  /** Indica si se envió el email de invitación al postulante */
  @Column({ name: 'email_sent', default: false })
  emailSent: boolean;

  /** Fecha y hora en que se envió el email de invitación */
  @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
  sentAt: Date | null;

  /** Número de intentos de envío (para tracking de reintentos) */
  @Column({ name: 'sent_count', default: 0 })
  sentCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
