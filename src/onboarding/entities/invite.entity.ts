import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('invites')
export class Invite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'call_id' })
  @Index('idx_invites_call')
  callId: string;

  @Column('uuid', { name: 'institution_id', nullable: true })
  institutionId: string | null;

  @Column({ name: 'code_hash', type: 'text', unique: true })
  @Index('idx_invites_active', { where: 'used_at IS NULL' })
  codeHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  @Index('idx_invites_expires')
  expiresAt: Date | null;

  @Column('uuid', { name: 'used_by_applicant', nullable: true })
  usedByApplicant: string | null;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, any> | null;

  @Column('uuid', { name: 'created_by_user_id', nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
