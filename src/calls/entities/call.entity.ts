import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CallStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED',
}

@Entity('calls')
export class Call {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'int' })
  year: number;

  @Column({
    type: 'enum',
    enum: CallStatus,
    default: CallStatus.DRAFT,
  })
  status: CallStatus;

  @Column({ name: 'total_seats', type: 'int', default: 0 })
  totalSeats: number;

  @Column({ name: 'min_per_institution', type: 'int', default: 0 })
  minPerInstitution: number;

  @Column({ type: 'jsonb', nullable: true })
  dates: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  rules: Record<string, any> | null;

  @Column({ name: 'form_published_at', type: 'timestamp', nullable: true })
  formPublishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
