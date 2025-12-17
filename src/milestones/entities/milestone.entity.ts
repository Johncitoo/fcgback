import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('milestones')
export class Milestone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'call_id' })
  callId: string;

  @Column({ type: 'uuid', nullable: true, name: 'form_id' })
  formId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'integer', default: 0, name: 'order_index' })
  orderIndex: number;

  @Column({ type: 'boolean', default: true })
  required: boolean;

  @Column({ type: 'simple-array', default: 'APPLICANT', name: 'who_can_fill' })
  whoCanFill: string[];

  @Column({ type: 'timestamptz', nullable: true, name: 'start_date' })
  startDate: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'due_date' })
  dueDate: Date;

  @Column({ type: 'varchar', length: 50, default: 'ACTIVE' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
