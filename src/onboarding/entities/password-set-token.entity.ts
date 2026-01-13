import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../users/entities/user.entity';

@Entity('password_set_tokens')
export class PasswordSetToken {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }

  @Column('uuid', { name: 'user_id' })
  @Index('idx_pst_user')
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User;

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
