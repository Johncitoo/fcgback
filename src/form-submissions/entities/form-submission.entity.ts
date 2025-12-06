import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('form_submissions')
export class FormSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'application_id' })
  applicationId: string;

  @Column({ type: 'uuid', nullable: true, name: 'form_id' })
  formId: string;

  @Column({ type: 'uuid', nullable: true, name: 'milestone_id' })
  milestoneId: string;

  @Column({ type: 'jsonb', default: '{}', name: 'form_data' })
  answers: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true, name: 'submitted_at' })
  submittedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
