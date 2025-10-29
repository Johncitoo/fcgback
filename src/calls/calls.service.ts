import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class CallsService {
  constructor(private ds: DataSource) {}

  async listCalls(params: {
    limit: number;
    offset: number;
    onlyActive: boolean;
    needCount: boolean;
  }) {
    const { limit, offset, onlyActive, needCount } = params;

    const whereClause = onlyActive ? "WHERE c.is_active = TRUE AND c.end_date >= NOW()" : '';

    const query = `
      SELECT 
        c.id,
        c.name,
        c.year,
        c.description,
        c.start_date as "startDate",
        c.end_date as "endDate",
        c.is_active as "isActive",
        c.created_at as "createdAt",
        c.updated_at as "updatedAt"
      FROM calls c
      ${whereClause}
      ORDER BY c.year DESC, c.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const data = await this.ds.query(query, [limit, offset]);

    let total: number | undefined;
    if (needCount) {
      const countQuery = `SELECT COUNT(*) as count FROM calls c ${whereClause}`;
      const countResult = await this.ds.query(countQuery);
      total = parseInt(countResult[0].count, 10);
    }

    return { data, total, limit, offset };
  }

  async getCallById(id: string) {
    const call = await this.ds.query(
      `
      SELECT 
        c.id,
        c.name,
        c.year,
        c.description,
        c.start_date as "startDate",
        c.end_date as "endDate",
        c.is_active as "isActive",
        c.created_at as "createdAt",
        c.updated_at as "updatedAt"
      FROM calls c
      WHERE c.id = $1
      LIMIT 1
      `,
      [id]
    );

    if (!call || call.length === 0) {
      throw new NotFoundException('Call not found');
    }

    return call[0];
  }

  async createCall(body: any) {
    if (!body.name || !body.year) {
      throw new BadRequestException('Name and year are required');
    }

    const result = await this.ds.query(
      `
      INSERT INTO calls (id, name, year, description, start_date, end_date, is_active)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
      RETURNING id, name, year, description, start_date as "startDate", end_date as "endDate", is_active as "isActive", created_at as "createdAt"
      `,
      [
        body.name,
        body.year,
        body.description || null,
        body.startDate || null,
        body.endDate || null,
        body.isActive !== undefined ? body.isActive : true,
      ]
    );

    return result[0];
  }

  async updateCall(id: string, body: any) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (body.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(body.name);
    }

    if (body.year !== undefined) {
      fields.push(`year = $${idx++}`);
      values.push(body.year);
    }

    if (body.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(body.description);
    }

    if (body.startDate !== undefined) {
      fields.push(`start_date = $${idx++}`);
      values.push(body.startDate);
    }

    if (body.endDate !== undefined) {
      fields.push(`end_date = $${idx++}`);
      values.push(body.endDate);
    }

    if (body.isActive !== undefined) {
      fields.push(`is_active = $${idx++}`);
      values.push(body.isActive);
    }

    if (fields.length === 0) {
      return { ok: true, updated: false };
    }

    values.push(id);
    const sql = `UPDATE calls SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING id`;
    const result = await this.ds.query(sql, values);

    if (!result || result.length === 0) {
      throw new NotFoundException('Call not found');
    }

    return { ok: true, updated: true };
  }

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
