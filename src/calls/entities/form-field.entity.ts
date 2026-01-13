import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { FormSection } from './form-section.entity';

@Entity('form_fields')
export class FormField {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }

  @Column({ name: 'call_id', type: 'uuid' })
  callId: string;

  @Column({ name: 'section_id', type: 'uuid' })
  sectionId: string;

  @ManyToOne(() => FormSection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section: FormSection;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  label: string;

  @Column({ type: 'varchar', length: 100 })
  type: string;

  @Column({ type: 'boolean', default: false })
  required: boolean;

  @Column({ type: 'jsonb', nullable: true })
  options: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  validation: Record<string, any> | null;

  @Column({ name: 'help_text', type: 'text', nullable: true })
  helpText: string | null;

  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
