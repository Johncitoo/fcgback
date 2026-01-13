import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('forms')
export class Form {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @Column({ type: 'boolean', default: false, name: 'is_template' })
  isTemplate: boolean;

  @Column({ type: 'uuid', nullable: true, name: 'parent_form_id' })
  parentFormId: string;

  @Column({ type: 'jsonb', nullable: true })
  schema: {
    sections?: Array<{
      id: string;
      title: string;
      description?: string;
      fields: Array<{
        id: string;
        name: string;
        label: string;
        type: string;
        helpText?: string;
        required?: boolean;
        active?: boolean;
        placeholder?: string;
        options?: Array<{ id: string; value: string; label: string }>;
      }>;
    }>;
  };

  @ManyToOne(() => Form, { nullable: true })
  @JoinColumn({ name: 'parent_form_id' })
  parentForm: Form;

  @OneToMany(() => Form, (form) => form.parentForm)
  versions: Form[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
