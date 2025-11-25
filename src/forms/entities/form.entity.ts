import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

@Entity('forms')
export class Form {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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
