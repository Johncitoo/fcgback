import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class CallsService {
  constructor(private ds: DataSource) {}

  async getForm(callId: string) {
    const call = (
      await this.ds.query(`SELECT id, name, year FROM calls WHERE id = $1 LIMIT 1`, [callId])
    )?.[0];
    if (!call) throw new NotFoundException('Call not found');

    const sections = await this.ds.query(
      `SELECT id, title, "order", visible FROM form_sections WHERE call_id = $1 ORDER BY "order" ASC`,
      [callId],
    );

    const fields = await this.ds.query(
      `SELECT id, section_id, name, label, type, required, options, validation, help_text, "order"
       FROM form_fields
       WHERE call_id = $1 AND active = TRUE
       ORDER BY "order" ASC`,
      [callId],
    );

    // agrupar campos por sección
    const bySection = sections.map((s: any) => ({
      ...s,
      fields: fields.filter((f: any) => f.section_id === s.id),
    }));

    return { ...call, sections: bySection };
  }
}
