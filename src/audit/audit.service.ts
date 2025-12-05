import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface AuditLogData {
  actorUserId?: string;
  action: string;
  entity: string;
  entityId?: string;
  meta?: Record<string, any>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly dataSource: DataSource) {}

  async log(data: AuditLogData): Promise<void> {
    try {
      await this.dataSource.query(
        `INSERT INTO audit_logs (actor_user_id, action, entity, entity_id, meta)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          data.actorUserId || null,
          data.action,
          data.entity,
          data.entityId || null,
          data.meta ? JSON.stringify(data.meta) : null,
        ],
      );

      this.logger.log(
        `Audit: ${data.action} on ${data.entity}${data.entityId ? ` (${data.entityId})` : ''} by ${data.actorUserId || 'SYSTEM'}`,
      );
    } catch (error) {
      this.logger.error(`Failed to write audit log: ${error}`);
      // No lanzamos error para no interrumpir el flujo principal
    }
  }

  async logInviteValidation(inviteId: string, applicantId: string, isNew: boolean): Promise<void> {
    return this.log({
      action: isNew ? 'INVITE_VALIDATED_NEW' : 'INVITE_VALIDATED_EXISTING',
      entity: 'invite',
      entityId: inviteId,
      meta: {
        applicantId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async logInviteRegenerated(oldInviteId: string, newInviteId: string, actorUserId?: string): Promise<void> {
    return this.log({
      actorUserId,
      action: 'INVITE_REGENERATED',
      entity: 'invite',
      entityId: newInviteId,
      meta: {
        oldInviteId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async logPasswordSet(userId: string): Promise<void> {
    return this.log({
      actorUserId: userId,
      action: 'PASSWORD_SET',
      entity: 'user',
      entityId: userId,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  async logLogin(userId: string, role: string, ip?: string): Promise<void> {
    return this.log({
      actorUserId: userId,
      action: 'USER_LOGIN',
      entity: 'user',
      entityId: userId,
      meta: {
        role,
        ip,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async logFormSubmitted(applicationId: string, applicantId: string): Promise<void> {
    return this.log({
      actorUserId: applicantId,
      action: 'FORM_SUBMITTED',
      entity: 'application',
      entityId: applicationId,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  async logApplicationStatusChange(
    applicationId: string,
    fromStatus: string,
    toStatus: string,
    actorUserId?: string,
  ): Promise<void> {
    return this.log({
      actorUserId,
      action: 'APPLICATION_STATUS_CHANGED',
      entity: 'application',
      entityId: applicationId,
      meta: {
        fromStatus,
        toStatus,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async getAuditLogs(filters: {
    action?: string;
    entity?: string;
    actor?: string;
    from?: string;
    to?: string;
    limit: number;
    offset: number;
  }): Promise<{ data: any[]; meta: { total: number; limit: number; offset: number } }> {
    const { action, entity, actor, from, to, limit, offset } = filters;

    let query = `
      SELECT 
        al.id,
        al.actor_user_id as actor_id,
        al.action,
        al.entity,
        al.entity_id,
        al.meta,
        al.created_at,
        u.email as actor_email,
        u.full_name as actor_name
      FROM audit_logs al
      LEFT JOIN users u ON al.actor_user_id = u.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (action) {
      query += ` AND al.action ILIKE $${paramIndex}`;
      params.push(`%${action}%`);
      paramIndex++;
    }

    if (entity) {
      query += ` AND al.entity ILIKE $${paramIndex}`;
      params.push(`%${entity}%`);
      paramIndex++;
    }

    if (actor) {
      query += ` AND (u.email ILIKE $${paramIndex} OR al.actor_user_id::text = $${paramIndex})`;
      params.push(`%${actor}%`);
      paramIndex++;
    }

    if (from) {
      query += ` AND al.created_at >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }

    if (to) {
      query += ` AND al.created_at <= $${paramIndex}`;
      params.push(to + ' 23:59:59');
      paramIndex++;
    }

    // Contar total
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as subquery`;
    const countResult = await this.dataSource.query(countQuery, params);
    const total = parseInt(countResult[0]?.total || '0', 10);

    // Agregar orden, limit y offset
    query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const data = await this.dataSource.query(query, params);

    return {
      data,
      meta: {
        total,
        limit,
        offset,
      },
    };
  }
}
