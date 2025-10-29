import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ApplicationsService {
  constructor(private ds: DataSource) {}

  async listApplications(params: {
    limit: number;
    offset: number;
    status?: string;
    callId?: string;
    needCount: boolean;
  }) {
    const { limit, offset, status, callId, needCount } = params;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (status) {
      conditions.push(`a.status = $${idx++}`);
      values.push(status);
    }

    if (callId) {
      conditions.push(`a.call_id = $${idx++}`);
      values.push(callId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    values.push(limit, offset);

    const query = `
      SELECT 
        a.id,
        a.applicant_id as "applicantId",
        a.call_id as "callId",
        a.status,
        a.created_at as "createdAt",
        a.submitted_at as "submittedAt",
        a.updated_at as "updatedAt",
        c.name as "callName",
        c.year as "callYear",
        u.email as "applicantEmail",
        u.full_name as "applicantName"
      FROM applications a
      LEFT JOIN calls c ON c.id = a.call_id
      LEFT JOIN users u ON u.applicant_id = a.applicant_id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    const data = await this.ds.query(query, values);

    let total: number | undefined;
    if (needCount) {
      const countQuery = `SELECT COUNT(*) as count FROM applications a ${whereClause}`;
      const countResult = await this.ds.query(countQuery, values.slice(0, -2));
      total = parseInt(countResult[0].count, 10);
    }

    return { data, total, limit, offset };
  }

  async getOrCreate(userId: string, callId: string) {
    // Trae applicantId del user
    const u = (await this.ds.query(
      `SELECT applicant_id FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    ))?.[0];
    if (!u?.applicant_id) {
      throw new BadRequestException('User has no applicant profile linked');
    }

    // ¿existe ya?
    const existing = await this.ds.query(
      `SELECT id, status FROM applications WHERE applicant_id = $1 AND call_id = $2 LIMIT 1`,
      [u.applicant_id, callId],
    );
    if (existing?.length) return { id: existing[0].id, status: existing[0].status, mode: 'existing' };

    // crea
    const created = await this.ds.query(
      `INSERT INTO applications
        (id, applicant_id, call_id, status)
       VALUES (gen_random_uuid(), $1, $2, 'DRAFT')
       RETURNING id, status`,
      [u.applicant_id, callId],
    );
    return { id: created[0].id, status: created[0].status, mode: 'created' };
  }

  async getById(userId: string, id: string) {
    const app = (await this.ds.query(
      `SELECT a.*
       FROM applications a
       JOIN users u ON u.applicant_id = a.applicant_id
       WHERE a.id = $1 AND u.id = $2
       LIMIT 1`,
      [id, userId],
    ))?.[0];
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  async patch(userId: string, id: string, dto: any) {
    // asegura ownership
    await this.getById(userId, id);

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const push = (col: string, val: any) => {
      fields.push(`${col} = $${idx++}`);
      values.push(val);
    };

    if (dto.academic !== undefined) push('academic', dto.academic);
    if (dto.household !== undefined) push('household', dto.household);
    if (dto.participation !== undefined) push('participation', dto.participation);
    if (dto.texts !== undefined) push('texts', dto.texts);
    if (dto.builderExtra !== undefined) push('builder_extra', dto.builderExtra);

    if (!fields.length) return { ok: true, updated: false };

    const sql = `UPDATE applications SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx}`;
    values.push(id);

    await this.ds.query(sql, values);
    return { ok: true, updated: true };
  }

  async submit(userId: string, id: string) {
    // ownership + estado
    const app = await this.getById(userId, id);
    if (app.status !== 'DRAFT' && app.status !== 'IN_REVIEW' && app.status !== 'NEEDS_FIX') {
      throw new BadRequestException('Invalid state to submit');
    }

    // Validación mínima demo: que exista academic y household
    if (!app.academic || !app.household) {
      throw new BadRequestException('Missing required sections (academic/household)');
    }

    await this.ds.query(
      `UPDATE applications
       SET status = 'SUBMITTED', submitted_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id],
    );

    await this.ds.query(
      `INSERT INTO application_status_history
         (id, application_id, from_status, to_status, actor_user_id, reason)
       VALUES (gen_random_uuid(), $1, $2, 'SUBMITTED', NULL, 'Submitted by applicant')`,
      [id, app.status ?? null],
    );

    return { ok: true, status: 'SUBMITTED' };
  }
}
