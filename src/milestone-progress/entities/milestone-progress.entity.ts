import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('milestone_progress')
export class MilestoneProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'application_id' })
  applicationId: string;

  @Column({ type: 'uuid', name: 'milestone_id' })
  milestoneId: string;

  @Column({ type: 'uuid', nullable: true, name: 'form_submission_id' })
  formSubmissionId: string;

  @Column({ type: 'varchar', length: 50, default: 'PENDING' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'started_at' })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'completed_at' })
  completedAt: Date;

  @Column({ type: 'uuid', nullable: true, name: 'completed_by' })
  completedBy: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
