import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Call } from './call.entity';

@Entity('form_sections')
export class FormSection {
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

  @ManyToOne(() => Call, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'call_id' })
  call: Call;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ type: 'boolean', default: true })
  visible: boolean;
}
