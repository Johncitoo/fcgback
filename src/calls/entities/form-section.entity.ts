import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Call } from './call.entity';

@Entity('form_sections')
export class FormSection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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
