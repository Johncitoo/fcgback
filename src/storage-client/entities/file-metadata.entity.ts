import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, BeforeInsert } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('files_metadata')
export class FileMetadata {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }

  @Column({ name: 'originalFilename' })
  originalFilename: string;

  @Column({ name: 'storedFilename' })
  storedFilename: string;

  @Column()
  mimetype: string;

  @Column({ type: 'bigint' })
  size: number;

  @Column({ type: 'enum', enum: ['PROFILE', 'DOCUMENT', 'FORM_FIELD', 'ATTACHMENT', 'OTHER'] })
  category: string;

  @Column({ type: 'enum', enum: ['USER', 'APPLICATION', 'FORM_ANSWER', 'INSTITUTION', 'OTHER'], name: 'entityType' })
  entityType: string;

  @Column({ type: 'uuid', name: 'entityId' })
  entityId: string;

  @Column()
  path: string;

  @Column({ nullable: true, name: 'thumbnailPath' })
  thumbnailPath: string;

  @Column({ type: 'uuid', name: 'uploadedBy' })
  uploadedBy: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @CreateDateColumn({ name: 'uploadedAt' })
  uploadedAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'uuid', nullable: true, name: 'milestone_submission_id' })
  milestoneSubmissionId: string;

  @Column({ nullable: true, name: 'mime_type_category' })
  mimeTypeCategory: string;
}
