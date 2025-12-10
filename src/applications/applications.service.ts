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
    overallStatus?: string;
    callId?: string;
    milestoneOrder?: number;
    needCount: boolean;
  }) {
    const { limit, offset, overallStatus, callId, milestoneOrder, needCount } = params;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (callId) {
      conditions.push(`a.call_id = $${idx++}`);
      values.push(callId);
    }

    if (milestoneOrder !== undefined) {
      // Filtrar por hito actual
      conditions.push(`EXISTS (
        SELECT 1 FROM milestone_progress mp
        JOIN milestones m ON m.id = mp.milestone_id
        WHERE mp.application_id = a.id 
          AND m.order_index = $${idx}
          AND mp.status NOT IN ('COMPLETED', 'REJECTED')
      )`);
      values.push(milestoneOrder);
      idx++;
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
        u.full_name as "applicantName",
        -- Hito actual (el primero que no está COMPLETED o REJECTED)
        (
          SELECT m.name 
          FROM milestone_progress mp
          JOIN milestones m ON m.id = mp.milestone_id
          WHERE mp.application_id = a.id 
            AND mp.status NOT IN ('COMPLETED', 'REJECTED')
          ORDER BY m.order_index ASC
          LIMIT 1
        ) as "currentMilestoneName",
        (
          SELECT m.order_index
          FROM milestone_progress mp
          JOIN milestones m ON m.id = mp.milestone_id
          WHERE mp.application_id = a.id 
            AND mp.status NOT IN ('COMPLETED', 'REJECTED')
          ORDER BY m.order_index ASC
          LIMIT 1
        ) as "currentMilestoneOrder",
        -- Estado general: APPROVED si todos los hitos están aprobados, REJECTED si alguno está rechazado, IN_REVIEW si hay alguno en revisión
        (
          SELECT CASE 
            WHEN COUNT(*) FILTER (WHERE mp.review_status = 'REJECTED' OR mp.status = 'REJECTED') > 0 THEN 'REJECTED'
            WHEN COUNT(*) FILTER (WHERE mp.status = 'COMPLETED' AND mp.review_status IS NULL) > 0 THEN 'IN_REVIEW'
            WHEN COUNT(*) FILTER (WHERE mp.review_status = 'NEEDS_CHANGES') > 0 THEN 'NEEDS_CHANGES'
            WHEN COUNT(*) FILTER (WHERE mp.status = 'COMPLETED' AND mp.review_status = 'APPROVED') = COUNT(*) THEN 'APPROVED'
            ELSE 'IN_PROGRESS'
          END
          FROM milestone_progress mp
          WHERE mp.application_id = a.id
        ) as "overallStatus"
      FROM applications a
      LEFT JOIN calls c ON c.id = a.call_id
      LEFT JOIN users u ON u.applicant_id = a.applicant_id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    let data = await this.ds.query(query, values);

    // Filtrar por overallStatus en memoria si se proporcionó
    if (overallStatus) {
      data = data.filter((row: any) => row.overallStatus === overallStatus);
    }

    let total: number | undefined;
    if (needCount) {
      total = data.length; // Usamos el length después del filtro
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

  async getByIdAdmin(id: string) {
    const app = (
      await this.ds.query(
        `SELECT 
          a.id,
          a.applicant_id as "applicantId",
          a.call_id as "callId",
          a.institution_id as "institutionId",
          a.status,
          a.total_score as "score",
          a.created_at as "createdAt",
          a.updated_at as "updatedAt",
          a.submitted_at as "submittedAt",
          c.name as "callName",
          c.year as "callYear",
          u.email as "applicantEmail",
          u.full_name as "applicantName",
          i.name as "institutionName"
       FROM applications a
       LEFT JOIN calls c ON c.id = a.call_id
       LEFT JOIN users u ON u.applicant_id = a.applicant_id
       LEFT JOIN institutions i ON i.id = a.institution_id
       WHERE a.id = $1
       LIMIT 1`,
        [id],
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
    await this.getById(userId, applicationId);

    // Obtener la última form_submission para esta application
    const submission = (
      await this.ds.query(
        `SELECT answers 
         FROM form_submissions 
         WHERE application_id = $1 
         ORDER BY submitted_at DESC NULLS LAST, created_at DESC
         LIMIT 1`,
        [applicationId],
      )
    )?.[0];

    // Si hay submission, devolver sus answers, sino devolver objeto vacío
    return submission?.answers || {};
  }

  /**
   * PATCH /api/applications/:id/answers
   * Guarda las respuestas del formulario (borrador)
   */
  async saveAnswers(userId: string, applicationId: string, answers: any) {
    // Verificar ownership
    await this.getById(userId, applicationId);

    // Buscar o crear form_submission para el Hito 1 (Postulación Inicial)
    // Asumimos que el formulario inicial es el primero del proceso
    const milestone = (
      await this.ds.query(
        `SELECT mp.id as milestone_progress_id, mp.milestone_id, m.form_id
         FROM milestone_progress mp
         JOIN milestones m ON m.id = mp.milestone_id
         WHERE mp.application_id = $1 
         AND m.order_index = 1
         LIMIT 1`,
        [applicationId],
      )
    )?.[0];

    if (!milestone?.form_id) {
      throw new BadRequestException('No se encontró el formulario inicial');
    }

    // Buscar form_submission existente
    const existing = (
      await this.ds.query(
        `SELECT id FROM form_submissions 
         WHERE application_id = $1 AND form_id = $2
         LIMIT 1`,
        [applicationId, milestone.form_id],
      )
    )?.[0];

    if (existing) {
      // Actualizar submission existente
      await this.ds.query(
        `UPDATE form_submissions 
         SET answers = $1, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(answers), existing.id],
      );
    } else {
      // Crear nueva submission
      await this.ds.query(
        `INSERT INTO form_submissions (application_id, form_id, milestone_id, answers)
         VALUES ($1, $2, $3, $4)`,
        [applicationId, milestone.form_id, milestone.milestone_id, JSON.stringify(answers)],
      );
    }

    return { ok: true, updated: true };
  }

  // ============ MÉTODOS DE ESTADÍSTICAS ============

  async getStatsOverview(callId: string) {
    const result = await this.ds.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'DRAFT' THEN 1 END) as draft,
        COUNT(CASE WHEN status = 'SUBMITTED' THEN 1 END) as submitted,
        COUNT(CASE WHEN status = 'IN_REVIEW' THEN 1 END) as in_review,
        COUNT(CASE WHEN status = 'NEEDS_FIX' THEN 1 END) as needs_fix,
        COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as rejected
       FROM applications
       WHERE call_id = $1`,
      [callId],
    );
    return result[0] || {};
  }

  async getGenderDistribution(callId: string) {
    const result = await this.ds.query(
      `SELECT 
        COALESCE(household->>'gender', 'No especificado') as gender,
        COUNT(*) as count
       FROM applications
       WHERE call_id = $1 AND status != 'DRAFT'
       GROUP BY household->>'gender'
       ORDER BY count DESC`,
      [callId],
    );
    return result;
  }

  async getTopInstitutions(callId: string) {
    const result = await this.ds.query(
      `SELECT 
        i.name as institution_name,
        COUNT(a.id) as count
       FROM applications a
       JOIN institutions i ON i.id = a.institution_id
       WHERE a.call_id = $1 AND a.status != 'DRAFT'
       GROUP BY i.id, i.name
       ORDER BY count DESC
       LIMIT 5`,
      [callId],
    );
    return result;
  }

  async getTopCommunes(callId: string) {
    const result = await this.ds.query(
      `SELECT 
        COALESCE(ap.commune, 'No especificada') as commune,
        COUNT(a.id) as count
       FROM applications a
       JOIN applicants ap ON ap.id = a.applicant_id
       WHERE a.call_id = $1 AND a.status != 'DRAFT'
       GROUP BY ap.commune
       ORDER BY count DESC
       LIMIT 5`,
      [callId],
    );
    return result;
  }

  async getScoreDistribution(callId: string) {
    const result = await this.ds.query(
      `SELECT 
        CASE 
          WHEN total_score IS NULL THEN 'Sin puntaje'
          WHEN total_score < 25 THEN '0-25'
          WHEN total_score < 50 THEN '26-50'
          WHEN total_score < 75 THEN '51-75'
          ELSE '76-100'
        END as score_range,
        COUNT(*) as count
       FROM applications
       WHERE call_id = $1 AND status IN ('SUBMITTED', 'IN_REVIEW', 'SELECTED', 'NOT_SELECTED')
       GROUP BY score_range
       ORDER BY score_range`,
      [callId],
    );
    return result;
  }

  async getSubmissionTimeline(callId: string) {
    const result = await this.ds.query(
      `SELECT 
        DATE(submitted_at) as submission_date,
        COUNT(*) as count
       FROM applications
       WHERE call_id = $1 AND submitted_at IS NOT NULL
       GROUP BY DATE(submitted_at)
       ORDER BY submission_date DESC
       LIMIT 30`,
      [callId],
    );
    return result;
  }
}
