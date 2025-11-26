import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../common/audit.service';

@Injectable()
export class ApplicationsService {
  constructor(
    private ds: DataSource,
    private auditService: AuditService,
  ) {}

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

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

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
    const u = (
      await this.ds.query(
        `SELECT applicant_id FROM users WHERE id = $1 LIMIT 1`,
        [userId],
      )
    )?.[0];
    if (!u?.applicant_id) {
      throw new BadRequestException('User has no applicant profile linked');
    }

    // ¿existe ya?
    const existing = await this.ds.query(
      `SELECT id, status FROM applications WHERE applicant_id = $1 AND call_id = $2 LIMIT 1`,
      [u.applicant_id, callId],
    );
    if (existing?.length)
      return {
        id: existing[0].id,
        status: existing[0].status,
        mode: 'existing',
      };

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

  // Obtener o crear application para la convocatoria activa (OPEN)
  async getOrCreateForActiveCall(userId: string) {
    // Buscar convocatoria activa (status = OPEN)
    const activeCall = (
      await this.ds.query(
        `SELECT id, name, year FROM calls WHERE status = 'OPEN' ORDER BY created_at DESC LIMIT 1`,
      )
    )?.[0];

    if (!activeCall) {
      throw new NotFoundException('No hay convocatoria activa en este momento');
    }

    // Obtener applicantId del usuario
    const u = (
      await this.ds.query(
        `SELECT applicant_id FROM users WHERE id = $1 LIMIT 1`,
        [userId],
      )
    )?.[0];

    if (!u?.applicant_id) {
      throw new BadRequestException('User has no applicant profile linked');
    }

    // Buscar application existente
    const existing = await this.ds.query(
      `SELECT 
        a.id,
        a.status,
        a.submitted_at,
        a.decided_at,
        a.notes,
        c.id as "callId",
        c.name as "callName",
        c.year as "callYear"
      FROM applications a
      JOIN calls c ON c.id = a.call_id
      WHERE a.applicant_id = $1 AND a.call_id = $2 
      LIMIT 1`,
      [u.applicant_id, activeCall.id],
    );

    if (existing?.length) {
      const app = existing[0];
      return {
        id: app.id,
        status: app.status,
        submitted_at: app.submitted_at,
        decided_at: app.decided_at,
        notes: app.notes,
        call: {
          id: app.callId,
          code: app.callName,
          title: `${app.callName} ${app.callYear}`,
        },
      };
    }

    // Crear nueva application
    const created = await this.ds.query(
      `INSERT INTO applications (id, applicant_id, call_id, status)
       VALUES (gen_random_uuid(), $1, $2, 'DRAFT')
       RETURNING id, status`,
      [u.applicant_id, activeCall.id],
    );

    return {
      id: created[0].id,
      status: created[0].status,
      submitted_at: null,
      decided_at: null,
      notes: null,
      call: {
        id: activeCall.id,
        code: activeCall.name,
        title: `${activeCall.name} ${activeCall.year}`,
      },
    };
  }

  async getById(userId: string, id: string) {
    const app = (
      await this.ds.query(
        `SELECT 
          a.id,
          a.applicant_id as "applicantId",
          a.call_id as "callId",
          a.status,
          a.created_at as "createdAt",
          a.updated_at as "updatedAt",
          a.submitted_at as "submittedAt"
       FROM applications a
       JOIN users u ON u.applicant_id = a.applicant_id
       WHERE a.id = $1 AND u.id = $2
       LIMIT 1`,
        [id, userId],
      )
    )?.[0];
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
    if (dto.participation !== undefined)
      push('participation', dto.participation);
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
    if (
      app.status !== 'DRAFT' &&
      app.status !== 'IN_REVIEW' &&
      app.status !== 'NEEDS_FIX'
    ) {
      throw new BadRequestException('Invalid state to submit');
    }

    // Validación mínima demo: que exista academic y household
    if (!app.academic || !app.household) {
      throw new BadRequestException(
        'Missing required sections (academic/household)',
      );
    }

    const oldStatus = app.status ?? 'DRAFT';

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
      [id, oldStatus],
    );

    // Auditoría
    this.auditService
      .logApplicationStatusChange(id, oldStatus, 'SUBMITTED', userId)
      .catch(() => {}); // No bloqueante

    return { ok: true, status: 'SUBMITTED' };
  }

  /**
   * Marca el código de invitación como completado después del envío del formulario
   */
  async completeInvite(userId: string, applicationId: string) {
    // Verificar ownership
    const app = await this.getById(userId, applicationId);

    // Buscar la invitación asociada
    const inviteResult = await this.ds.query(
      `SELECT i.id FROM invites i
       INNER JOIN applicants a ON i.applicant_id = a.id
       WHERE a.user_id = $1 AND i.used_at IS NULL
       LIMIT 1`,
      [userId],
    );

    if (inviteResult && inviteResult.length > 0) {
      const inviteId = inviteResult[0].id;

      // Marcar como usado
      await this.ds.query(
        `UPDATE invites SET used_at = NOW() WHERE id = $1`,
        [inviteId],
      );
    }

    return { ok: true };
  }

  /**
   * GET /api/applications/:id/answers
   * Devuelve las respuestas guardadas del formulario
   */
  async getAnswers(userId: string, applicationId: string) {
    // Verificar ownership
    const app = await this.getById(userId, applicationId);

    // Por ahora, devolvemos las columnas JSON que ya están en applications
    return {
      academic: app.academic || {},
      household: app.household || {},
      participation: app.participation || {},
      texts: app.texts || {},
      builderExtra: app.builderExtra || {},
    };
  }

  /**
   * PATCH /api/applications/:id/answers
   * Guarda las respuestas del formulario (borrador)
   */
  async saveAnswers(userId: string, applicationId: string, answers: any) {
    // Verificar ownership
    await this.getById(userId, applicationId);

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const push = (col: string, val: any) => {
      fields.push(`${col} = $${idx++}`);
      values.push(val);
    };

    // Guardar cada sección como JSON
    if (answers.academic !== undefined) push('academic', JSON.stringify(answers.academic));
    if (answers.household !== undefined) push('household', JSON.stringify(answers.household));
    if (answers.participation !== undefined) push('participation', JSON.stringify(answers.participation));
    if (answers.texts !== undefined) push('texts', JSON.stringify(answers.texts));
    if (answers.builderExtra !== undefined) push('builder_extra', JSON.stringify(answers.builderExtra));

    if (!fields.length) return { ok: true, updated: false };

    const sql = `UPDATE applications SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx}`;
    values.push(applicationId);

    await this.ds.query(sql, values);
    return { ok: true, updated: true };
  }
}
