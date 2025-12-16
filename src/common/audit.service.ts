import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface AuditLogData {
  actorUserId?: string;
  action: string;
  entity: string;
  entityId?: string;
  meta?: Record<string, any>;
}

/**
 * Service para registro de auditoría del sistema.
 * 
 * Registra todas las acciones críticas en la tabla audit_logs:
 * - Creación, actualización y eliminación de registros
 * - Validación de códigos de invitación
 * - Establecimiento de contraseñas
 * - Logins y logouts
 * - Envío de emails
 * - Cambios en estados de aplicaciones
 * 
 * Campos registrados:
 * - actor_user_id: Usuario que realizó la acción
 * - action: Tipo de acción (CREATE, UPDATE, DELETE, etc.)
 * - entity: Tipo de entidad afectada (USER, APPLICATION, INVITE, etc.)
 * - entity_id: ID del registro afectado
 * - meta: JSON con información adicional
 * - created_at: Timestamp automático
 * 
 * Los logs no bloquean el flujo principal si falla el registro.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Registra una acción en el log de auditoría.
   * 
   * Inserta un registro en audit_logs y escribe en el logger.
   * No lanza errores si falla para no interrumpir el flujo principal.
   * 
   * @param data - Datos de la acción a registrar
   * @param data.actorUserId - ID del usuario que realizó la acción (opcional, 'SYSTEM' si no se provee)
   * @param data.action - Tipo de acción (CREATE, UPDATE, DELETE, LOGIN, etc.)
   * @param data.entity - Tipo de entidad afectada (USER, APPLICATION, INVITE, etc.)
   * @param data.entityId - ID del registro afectado (opcional)
   * @param data.meta - Información adicional en formato JSON (opcional)
   * 
   * @example
   * await log({ action: 'CREATE', entity: 'USER', entityId: 'uuid-123', actorUserId: 'uuid-admin' });
   */
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
      action: 'APPLICATION_STATUS_CHANGE',
      entity: 'application',
      entityId: applicationId,
      meta: {
        from: fromStatus,
        to: toStatus,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async getAuditLogs(params: {
    action?: string;
    entity?: string;
    actor?: string;
    from?: string;
    to?: string;
    limit: number;
    offset: number;
  }): Promise<{ data: any[]; total?: number }> {
    const { action, entity, actor, from, to, limit, offset } = params;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (action) {
      conditions.push(`action = $${idx++}`);
      values.push(action);
    }

    if (entity) {
      conditions.push(`entity = $${idx++}`);
      values.push(entity);
    }

    if (actor) {
      conditions.push(`actor_user_id = $${idx++}`);
      values.push(actor);
    }

    if (from) {
      conditions.push(`created_at >= $${idx++}`);
      values.push(from);
    }

    if (to) {
      conditions.push(`created_at <= $${idx++}`);
      values.push(to);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    values.push(limit, offset);

    const query = `
      SELECT 
        id,
        actor_user_id as "actorUserId",
        action,
        entity,
        entity_id as "entityId",
        meta,
        created_at as "createdAt"
      FROM audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    const data = await this.dataSource.query(query, values);

    const countQuery = `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`;
    const countResult = await this.dataSource.query(
      countQuery,
      values.slice(0, values.length - 2),
    );
    const total = parseInt(countResult[0].count, 10);

    return { data, total };
  }
}
