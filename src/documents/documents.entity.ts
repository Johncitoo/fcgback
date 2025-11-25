import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DocumentType {
  GRADES = 'GRADES',
  ID = 'ID',
  INCOME = 'INCOME',
  ENROLLMENT = 'ENROLLMENT',
  OTHER = 'OTHER',
}

// Mantén estos valores alineados con el enum de BD (document_status)
export enum ValidationStatus {
  PENDING = 'PENDING',
  VALID = 'VALID',
  INVALID = 'INVALID',
}

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'application_id' })
  applicationId: string;

  // En BD es enum document_type; aquí lo mapeamos como string (text) para no forzar migraciones
  @Column({ name: 'type', type: 'text' })
  type: DocumentType;

  @Column({ name: 'filename', type: 'text' })
  fileName: string;

  @Column({ name: 'storage_key', type: 'text', nullable: true })
  storageKey: string | null;

  @Column({ name: 'content_type', type: 'text', nullable: true })
  contentType: string | null;

  @Column({
    name: 'size_bytes',
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (v?: number | null) => v ?? null,
      from: (v?: string | null) => (v == null ? null : Number(v)),
    },
  })
  sizeBytes: number | null;

  @Column({ name: 'checksum', type: 'text', nullable: true })
  checksum: string | null;

  // En BD es enum document_status; aquí lo mapeamos como text (string)
  @Column({
    name: 'validation_status',
    type: 'text',
    default: ValidationStatus.PENDING,
  })
  validationStatus: ValidationStatus;

  @Column({ name: 'invalid_reason', type: 'text', nullable: true })
  invalidReason: string | null;

  @Column({ name: 'validated_by', type: 'uuid', nullable: true })
  validatedBy: string | null;

  @Column({ name: 'validated_at', type: 'timestamptz', nullable: true })
  validatedAt: Date | null;

  @Column({ name: 'version', type: 'int', default: 1 })
  version: number;

  @Column({ name: 'is_current', type: 'boolean', default: true })
  isCurrent: boolean;

  @Column({ name: 'form_field_id', type: 'uuid', nullable: true })
  formFieldId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
