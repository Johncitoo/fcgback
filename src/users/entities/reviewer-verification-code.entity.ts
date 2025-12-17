import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('reviewer_verification_codes')
@Index(['code', 'requesterUserId'], { where: 'used = false' })
export class ReviewerVerificationCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 6 })
  code: string;

  @Column({ type: 'uuid', name: 'requester_user_id' })
  requesterUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requester_user_id' })
  requesterUser: User;

  @Column({ type: 'varchar', length: 255, name: 'pending_email' })
  pendingEmail: string;

  @Column({ type: 'varchar', length: 255, name: 'pending_full_name' })
  pendingFullName: string;

  @Column({ type: 'text', name: 'pending_password_hash' })
  pendingPasswordHash: string;

  @Column({ type: 'boolean', default: false })
  used: boolean;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
