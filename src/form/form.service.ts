import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class FormService {
  constructor(private ds: DataSource) {}

  async getForm(callId: string) {
    // Verifica que exista la call
    const call = await this.ds.query(
      `SELECT id, name, year, status FROM calls WHERE id = $1 LIMIT 1`,
      [callId],
    );
    if (!call?.length) throw new NotFoundException('Call not found');

    const sections = await this.ds.query(
      `SELECT id, title, "order", visible
       FROM form_sections
       WHERE call_id = $1
       ORDER BY "order" ASC, title ASC`,
      [callId],
    );

    const fields = await this.ds.query(
      `SELECT id, section_id, name, label, type, required, options, validation, help_text, show_if, "order", active, visibility, editable_by_roles
       FROM form_fields
       WHERE call_id = $1 AND active = TRUE
       ORDER BY "order" ASC, label ASC`,
      [callId],
    );

    const docs = await this.ds.query(
      `SELECT type, required, accept, max_size_mb
       FROM call_document_requirements
       WHERE call_id = $1`,
      [callId],
    );

    return { call: call[0], sections, fields, requirements: docs };
  }
}
