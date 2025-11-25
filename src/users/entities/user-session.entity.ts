import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('user_sessions')
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, (u) => u.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'text', name: 'refresh_token_hash' })
  refreshTokenHash!: string;

  @Index()
  @Column({ type: 'uuid', name: 'token_family_id' })
  tokenFamilyId!: string;

  @Column({ type: 'uuid', name: 'rotated_from_session_id', nullable: true })
  rotatedFromSessionId: string | null;

  @Column({ type: 'text', name: 'user_agent', nullable: true })
  userAgent: string | null;

  @Column({ type: 'inet', name: 'ip', nullable: true })
  ip: string | null;

  @Index()
  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @Index()
  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
