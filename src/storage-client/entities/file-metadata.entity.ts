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

  @Column({ name: 'original_filename' })
  originalFilename: string;

  @Column({ name: 'stored_filename' })
  storedFilename: string;

  @Column()
  mimetype: string;

  @Column({ type: 'bigint' })
  size: number;

  @Column({ type: 'enum', enum: ['PROFILE', 'DOCUMENT', 'FORM_FIELD', 'ATTACHMENT', 'OTHER'] })
  category: string;

  @Column({ type: 'enum', enum: ['USER', 'APPLICATION', 'FORM_ANSWER', 'INSTITUTION', 'OTHER'], name: 'entity_type' })
  entityType: string;

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId: string;

  @Column()
  path: string;

  @Column({ nullable: true, name: 'thumbnail_path' })
  thumbnailPath: string;

  @Column({ type: 'uuid', name: 'uploaded_by' })
  uploadedBy: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'uuid', nullable: true, name: 'milestone_submission_id' })
  milestoneSubmissionId: string;

  @Column({ nullable: true, name: 'mime_type_category' })
  mimeTypeCategory: string;
}
