import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
  OneToMany,
  BeforeInsert,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { v4 as uuidv4 } from 'uuid';
import { UserSession } from '../entities/user-session.entity';

export type UserRole = 'ADMIN' | 'REVIEWER' | 'APPLICANT';

@Entity('users')
export class User {
  @PrimaryColumn('uuid')
  id!: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }

  @Index({ unique: true })
  @Column({ type: 'citext' })
  email!: string;

  @Column({ type: 'text', name: 'password_hash' })
  @Exclude()
  passwordHash!: string;

  @Column({
    type: 'timestamptz',
    name: 'password_updated_at',
    default: () => 'NOW()',
  })
  passwordUpdatedAt!: Date;

  @Column({ type: 'text', name: 'full_name' })
  fullName!: string;

  @Index()
  @Column({
    type: 'enum',
    enum: ['ADMIN', 'REVIEWER', 'APPLICANT'],
    enumName: 'user_role',
  })
  role!: UserRole;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'uuid', name: 'applicant_id', nullable: true })
  applicantId: string | null;

  @Column({ type: 'timestamptz', name: 'last_login_at', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => UserSession, (s) => s.user)
  sessions!: UserSession[];
}
