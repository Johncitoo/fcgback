import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('password_set_tokens')
export class PasswordSetToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'user_id' })
  @Index('idx_pst_user')
  userId: string;

  @Column({ name: 'token_hash', type: 'text', unique: true })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  @Index('idx_pst_expires')
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @Column({ name: 'issued_ip', type: 'inet', nullable: true })
  issuedIp: string | null;

  @Column({ name: 'issued_user_agent', type: 'text', nullable: true })
  issuedUserAgent: string | null;

  @Column({ name: 'consumed_ip', type: 'inet', nullable: true })
  consumedIp: string | null;

  @Column({ name: 'consumed_user_agent', type: 'text', nullable: true })
  consumedUserAgent: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
