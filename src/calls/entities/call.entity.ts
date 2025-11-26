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

  @Column({ name: 'start_date', type: 'timestamp', nullable: true })
  startDate: Date | null;

  @Column({ name: 'end_date', type: 'timestamp', nullable: true })
  endDate: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive: boolean;

  @Column({ name: 'auto_close', type: 'boolean', default: true })
  autoClose: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Computed property: Determina si la convocatoria está activa en este momento
  get isCurrentlyActive(): boolean {
    if (!this.isActive || this.status !== CallStatus.OPEN) {
      return false;
    }

    const now = new Date();

    // Validar fecha de inicio
    if (this.startDate && now < this.startDate) {
      return false;
    }

    // Validar fecha de cierre automático
    if (this.autoClose && this.endDate && now > this.endDate) {
      return false;
    }

    return true;
  }
}
