import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OnboardingService } from './onboarding.service';
import { Roles } from '../auth/roles.decorator';

/**
 * Controlador para gestión de invitaciones.
 * 
 * Proporciona endpoints para:
 * - Listar invitaciones con filtros por convocatoria
 * - Crear invitaciones individuales (con envío opcional de email)
 * - Obtener detalles de invitación
 * - Regenerar código de invitación
 * - Envío masivo a postulantes sin invitar
 * 
 * Características:
 * - Generación automática de códigos formato TEST-XXXXXXXX
 * - Integración con OnboardingService para lógica de negocio
 * - Envío de emails automático en creación y regeneración
 * - Filtrado de postulantes ya invitados en envío masivo
 * 
 * Seguridad: ADMIN y REVIEWER
 */
@Controller('invites')
@Roles('ADMIN', 'REVIEWER') // Todo el controlador requiere admin o revisor
export class InvitesController {
  constructor(
    private ds: DataSource,
    private onboarding: OnboardingService,
  ) {}

  /**
   * GET /api/invites
   * 
   * Lista invitaciones con paginación y filtros opcionales.
   * Incluye datos de convocatoria asociada (callName, callYear).
   * 
   * @param limit - Cantidad de resultados (default: 20)
   * @param offset - Desplazamiento para paginación (default: 0)
   * @param callId - Filtro opcional por convocatoria
   * @param count - Si es '1' o 'true', incluye total de registros
   * @returns Objeto con data (array de invitaciones), total (opcional), limit, offset
   */
  @Get()
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('callId') callId?: string,
    @Query('count') count?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    const needCount = count === '1' || count === 'true';

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (callId) {
      conditions.push(`i.call_id = $${idx++}`);
      values.push(callId);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    values.push(limitNum, offsetNum);

    const query = `
      SELECT DISTINCT ON (i.meta->>'email', i.call_id)
        i.id,
        i.call_id as "callId",
        i.institution_id as "institutionId",
        i.expires_at as "expiresAt",
        i.used_at as "usedAt",
        i.created_at as "createdAt",
        i.meta->>'email' as "email",
        COALESCE(i.meta->>'firstName', a.first_name) as "firstName",
        COALESCE(i.meta->>'lastName', a.last_name) as "lastName",
        CASE WHEN i.used_at IS NOT NULL THEN true ELSE false END as "used",
        i.code_hash as "code_hash",
        i.email_sent as "emailSent",
        i.sent_at as "sentAt",
        i.sent_count as "sentCount",
        c.name as "callName",
        c.year as "callYear"
      FROM invites i
      LEFT JOIN calls c ON c.id = i.call_id
      LEFT JOIN users u ON u.email = i.meta->>'email'
      LEFT JOIN applicants a ON a.id = u.applicant_id
      ${whereClause}
      ORDER BY i.meta->>'email', i.call_id, i.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    const data = await this.ds.query(query, values);

    let total: number | undefined;
    if (needCount) {
      const countQuery = `SELECT COUNT(*) as count FROM invites i ${whereClause}`;
      const countResult = await this.ds.query(countQuery, values.slice(0, -2));
      total = parseInt(countResult[0].count, 10);
    }

    return { data, total, limit: limitNum, offset: offsetNum };
  }

  /**
   * POST /api/invites
   * 
   * Crea una nueva invitación individual.
   * 
   * Flujo:
   * 1. Genera código automático si no se proporciona
   * 2. Crea invitación en BD
   * 3. Envía email si email está presente y sendEmail !== false
   * 
   * @param body - Objeto con:
   *   - callId (requerido): ID de la convocatoria
   *   - code (opcional): Código custom, si no se proporciona genera automáticamente
   *   - ttlDays (opcional): Días de validez
   *   - institutionId (opcional): Institución asociada
   *   - email (opcional): Email del invitado
   *   - firstName (opcional): Nombre del invitado
   *   - lastName (opcional): Apellido del invitado
   *   - sendEmail (opcional): Si es false, no envía email (default: true si hay email)
   * @returns Invitación creada con code e invitationCode
   * @throws BadRequestException si falta callId
   */
  @Post()
  async create(
    @Body()
    body: {
      callId: string;
      code?: string;
      ttlDays?: number;
      institutionId?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      sendEmail?: boolean;
    },
  ) {
    if (!body.callId) {
      throw new BadRequestException('callId is required');
    }

    // Si no se proporciona código, generar uno automáticamente
    const code = body.code || this.generateInviteCode();

    const invite = await this.onboarding.devCreateInvite(
      body.callId,
      code,
      body.ttlDays,
      body.institutionId,
      body.firstName,
      body.lastName,
      body.email,
    );

    // Si se proporciona email y sendEmail=true, enviar invitación
    if (body.email && body.sendEmail !== false) {
      await this.onboarding.sendInitialInvite(
        invite.id,
        body.email,
        code,
        body.firstName,
        body.lastName,
      );
    }

    return { ...invite, code, invitationCode: code };
  }

  /**
   * Genera código de invitación aleatorio formato TEST-XXXXXXXX.
   * Usa caracteres A-Z y 0-9.
   * 
   * @returns Código de 13 caracteres (TEST- + 8 random)
   */
  private generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'TEST-';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * GET /api/invites/:id
   * 
   * Obtiene detalles completos de una invitación.
   * Incluye datos de convocatoria asociada y metadata (email, firstName, lastName).
   * 
   * @param id - UUID de la invitación
   * @returns Invitación con campos: id, callId, institutionId, expiresAt, usedAt, email, firstName, lastName, used, callName, callYear
   * @throws BadRequestException si no existe
   */
  @Get(':id')
  async getById(@Param('id') id: string) {
    const result = await this.ds.query(
      `
      SELECT 
        i.id,
        i.call_id as "callId",
        i.institution_id as "institutionId",
        i.expires_at as "expiresAt",
        i.used_at as "usedAt",
        i.created_at as "createdAt",
        i.meta->>'email' as "email",
        i.meta->>'firstName' as "firstName",
        i.meta->>'lastName' as "lastName",
        CASE WHEN i.used_at IS NOT NULL THEN true ELSE false END as "used",
        i.email_sent as "emailSent",
        i.sent_at as "sentAt",
        i.sent_count as "sentCount",
        c.name as "callName",
        c.year as "callYear"
      FROM invites i
      LEFT JOIN calls c ON c.id = i.call_id
      WHERE i.id = $1
      LIMIT 1
      `,
      [id],
    );

    if (!result || result.length === 0) {
      throw new BadRequestException('Invite not found');
    }

    return result[0];
  }

  /**
   * POST /api/invites/bulk
   * 
   * Crea invitaciones en lote para múltiples emails.
   * NO envía emails automáticamente, solo crea los registros.
   * 
   * @param body - Objeto con:
   *   - callId (requerido): ID de la convocatoria
   *   - emails (requerido): Array de emails
   * @returns Objeto con created, duplicates, invalid
   * @throws BadRequestException si falta callId o emails
   */
  @Post('bulk')
  async bulkCreate(
    @Body()
    body: {
      callId: string;
      emails: string[];
    },
  ) {
    if (!body.callId) {
      throw new BadRequestException('callId is required');
    }
    if (!body.emails || !Array.isArray(body.emails) || body.emails.length === 0) {
      throw new BadRequestException('emails array is required');
    }

    let created = 0;
    let duplicates = 0;
    let invalid = 0;

    for (const email of body.emails) {
      const trimmedEmail = email.trim().toLowerCase();
      
      // Validar formato de email
      if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        invalid++;
        continue;
      }

      try {
        // Verificar si ya existe invitación para este email y convocatoria
        const existing = await this.ds.query(
          `SELECT id FROM invites WHERE call_id = $1 AND LOWER(COALESCE(meta->>'email', email)) = $2 LIMIT 1`,
          [body.callId, trimmedEmail],
        );

        if (existing.length > 0) {
          duplicates++;
          continue;
        }

        // Crear invitación (sin enviar email)
        const code = this.generateInviteCode();
        await this.onboarding.devCreateInvite(
          body.callId,
          code,
          undefined, // ttlDays
          undefined, // institutionId
          undefined, // firstName
          undefined, // lastName
          trimmedEmail,
        );

        created++;
      } catch (err) {
        console.error(`Error creando invitación para ${trimmedEmail}:`, err);
        invalid++;
      }
    }

    return {
      created,
      duplicates,
      invalid,
      total: body.emails.length,
    };
  }

  /**
   * POST /api/invites/:id/regenerate
   * 
   * Regenera el código de una invitación existente.
   * El código anterior queda invalidado.
   * Envía email con nuevo código automáticamente.
   * 
   * @param id - UUID de la invitación
   * @param body - Objeto con code (nuevo código)
   * @returns Objeto con success, message, inviteId, code
   * @throws BadRequestException si falta code
   */
  @Post(':id/regenerate')
  async regenerate(
    @Param('id') id: string,
    @Body() body: { code: string },
  ) {
    if (!body.code) {
      throw new BadRequestException('code is required');
    }

    const result = await this.onboarding.regenerateInviteCode(id, body.code);
    
    return {
      success: true,
      message: 'Código regenerado exitosamente',
      inviteId: result.invite.id,
      code: result.plainCode,
    };
  }

  /**
   * POST /api/invites/bulk-send
   * 
   * Envío masivo de invitaciones con detección de envíos previos y límite diario.
   * 
   * Características principales:
   * 1. Detección automática de invitaciones ya enviadas (email_sent = true)
   * 2. Respeta límite diario de cuota de emails
   * 3. Envío incremental: si se queda sin cuota, marca las enviadas y permite continuar otro día
   * 4. Personalización: cada email incluye nombre del postulante y código único
   * 
   * Modos de operación:
   * 1. sendToAll = true: Procesa TODOS los postulantes con invitación NO enviada en callId
   * 2. applicantIds: Procesa solo IDs especificados que no tengan email enviado
   * 
   * Límite diario:
   * - maxEmails (opcional): Límite máximo de envíos en esta ejecución
   * - Si se alcanza el límite, los pendientes quedan para el siguiente día
   * - El sistema marca cada invitación con email_sent=true y sent_at al enviar exitosamente
   * 
   * Lógica de filtrado:
   * - Busca invitaciones existentes donde email_sent = false
   * - Si no existe invitación, la crea con email_sent = false
   * - Envía emails hasta alcanzar maxEmails o procesar todos
   * - Marca cada envío exitoso con email_sent = true, sent_at = NOW()
   * 
   * @param body - Objeto con:
   *   - callId (requerido): ID de la convocatoria
   *   - sendToAll (opcional): Si true, procesa todos los pendientes de envío
   *   - applicantIds (opcional): Lista de IDs específicos a procesar
   *   - maxEmails (opcional): Límite máximo de emails a enviar (default: sin límite)
   * @returns Objeto con:
   *   - sent: Cantidad de emails enviados exitosamente
   *   - failed: Cantidad de envíos fallidos
   *   - pending: Cantidad de invitaciones pendientes de envío (por límite o errores)
   *   - total: Total de invitaciones procesadas
   *   - errors: Array de errores detallados (opcional)
   *   - message: Mensaje descriptivo del resultado
   * @throws BadRequestException si falta callId
   * 
   * @example
   * // Enviar a todos los pendientes, máximo 40 emails
   * POST /api/invites/bulk-send
   * { "callId": "uuid", "sendToAll": true, "maxEmails": 40 }
   * 
   * @example
   * // Enviar a postulantes específicos
   * POST /api/invites/bulk-send
   * { "callId": "uuid", "applicantIds": ["id1", "id2", "id3"] }
   */
  @Post('bulk-send')
  async bulkSend(
    @Body()
    body: {
      callId: string;
      sendToAll?: boolean;
      applicantIds?: string[];
      maxEmails?: number; // Límite máximo de emails a enviar
    },
  ) {
    if (!body.callId) {
      throw new BadRequestException('callId is required');
    }

    const maxEmails = body.maxEmails && body.maxEmails > 0 ? body.maxEmails : null;

    // PASO 1: Obtener invitaciones pendientes de envío (email_sent = false)
    let pendingInvites: any[] = [];

    if (body.sendToAll) {
      // Buscar todas las invitaciones pendientes de envío para esta convocatoria
      pendingInvites = await this.ds.query(
        `
        SELECT 
          i.id,
          i.meta->>'email' as email,
          COALESCE(i.meta->>'firstName', a.first_name) as "firstName",
          COALESCE(i.meta->>'lastName', a.last_name) as "lastName"
        FROM invites i
        LEFT JOIN users u ON u.email = i.meta->>'email'
        LEFT JOIN applicants a ON a.id = u.applicant_id
        WHERE i.call_id = $1
          AND i.email_sent = false
          AND i.meta->>'email' IS NOT NULL
        ORDER BY i.created_at ASC
        ${maxEmails ? `LIMIT ${maxEmails}` : ''}
        `,
        [body.callId],
      );
    } else if (body.applicantIds && body.applicantIds.length > 0) {
      // Buscar invitaciones específicas pendientes de envío
      pendingInvites = await this.ds.query(
        `
        SELECT 
          i.id,
          i.meta->>'email' as email,
          COALESCE(i.meta->>'firstName', a.first_name) as "firstName",
          COALESCE(i.meta->>'lastName', a.last_name) as "lastName"
        FROM invites i
        LEFT JOIN users u ON u.email = i.meta->>'email'
        INNER JOIN applicants a ON a.id = u.applicant_id
        WHERE i.call_id = $1
          AND i.email_sent = false
          AND a.id = ANY($2)
          AND i.meta->>'email' IS NOT NULL
        ORDER BY i.created_at ASC
        ${maxEmails ? `LIMIT ${maxEmails}` : ''}
        `,
        [body.callId, body.applicantIds],
      );
    }

    // PASO 2: Si no hay invitaciones pendientes, buscar postulantes sin invitación
    if (pendingInvites.length === 0) {
      let applicantsWithoutInvite: any[] = [];

      if (body.sendToAll) {
        applicantsWithoutInvite = await this.ds.query(
          `
          SELECT DISTINCT 
            a.id,
            u.email,
            a.first_name as "firstName",
            a.last_name as "lastName"
          FROM applicants a
          INNER JOIN users u ON u.applicant_id = a.id
          WHERE NOT EXISTS (
            SELECT 1 FROM invites i 
            WHERE i.call_id = $1 
            AND i.meta->>'email' = u.email
          )
          AND u.is_active = true
          ORDER BY a.created_at DESC
          ${maxEmails ? `LIMIT ${maxEmails}` : ''}
          `,
          [body.callId],
        );
      } else if (body.applicantIds && body.applicantIds.length > 0) {
        applicantsWithoutInvite = await this.ds.query(
          `
          SELECT DISTINCT 
            a.id,
            u.email,
            a.first_name as "firstName",
            a.last_name as "lastName"
          FROM applicants a
          INNER JOIN users u ON u.applicant_id = a.id
          WHERE a.id = ANY($1)
            AND u.is_active = true
            AND NOT EXISTS (
              SELECT 1 FROM invites i 
              WHERE i.call_id = $2 
              AND i.meta->>'email' = u.email
            )
          ORDER BY a.created_at DESC
          ${maxEmails ? `LIMIT ${maxEmails}` : ''}
          `,
          [body.applicantIds, body.callId],
        );
      }

      // Crear invitaciones para estos postulantes (sin enviar email aún)
      for (const applicant of applicantsWithoutInvite) {
        try {
          const code = this.generateInviteCode();
          const invite = await this.onboarding.devCreateInvite(
            body.callId,
            code,
            undefined,
            undefined,
            applicant.firstName,
            applicant.lastName,
            applicant.email,
          );

          pendingInvites.push({
            id: invite.id,
            email: applicant.email,
            firstName: applicant.firstName,
            lastName: applicant.lastName,
            code, // Guardar el código en claro temporalmente para envío
          });
        } catch (err: any) {
          // Error al crear invitación, ignorar y continuar
          console.error(`Error creando invitación para ${applicant.email}:`, err.message);
        }
      }
    } else {
      // Obtener códigos originales de las invitaciones pendientes
      // PROBLEMA: No podemos recuperar el código original porque está hasheado
      // SOLUCIÓN: Regenerar código para invitaciones pendientes que no se enviaron
      for (let i = 0; i < pendingInvites.length; i++) {
        const invite = pendingInvites[i];
        const newCode = this.generateInviteCode();
        
        try {
          // Actualizar el hash del código en la BD
          const codeHash = await this.hashCode(newCode);
          await this.ds.query(
            `UPDATE invites SET code_hash = $1 WHERE id = $2`,
            [codeHash, invite.id],
          );
          
          pendingInvites[i].code = newCode;
        } catch (err) {
          console.error(`Error regenerando código para invitación ${invite.id}:`, err);
        }
      }
    }

    if (pendingInvites.length === 0) {
      return {
        success: true,
        sent: 0,
        failed: 0,
        pending: 0,
        total: 0,
        message: 'No hay invitaciones pendientes de envío',
      };
    }

    // PASO 3: Enviar emails
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    const toProcess = maxEmails ? pendingInvites.slice(0, maxEmails) : pendingInvites;

    for (const invite of toProcess) {
      try {
        // Enviar email
        await this.onboarding.sendInitialInvite(
          invite.id,
          invite.email,
          invite.code,
          invite.firstName,
          invite.lastName,
        );

        // Marcar como enviado en la BD
        await this.ds.query(
          `
          UPDATE invites 
          SET email_sent = true, 
              sent_at = NOW(),
              sent_count = sent_count + 1
          WHERE id = $1
          `,
          [invite.id],
        );

        results.sent++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`${invite.email}: ${err.message || 'Error desconocido'}`);
      }
    }

    // PASO 4: Calcular pendientes
    const totalInvites = await this.ds.query(
      `SELECT COUNT(*) as count FROM invites WHERE call_id = $1 AND email_sent = false`,
      [body.callId],
    );
    const pending = parseInt(totalInvites[0].count, 10);

    return {
      success: true,
      sent: results.sent,
      failed: results.failed,
      pending,
      total: toProcess.length,
      errors: results.errors.length > 0 ? results.errors : undefined,
      message: `${results.sent} invitaciones enviadas, ${results.failed} fallidas${pending > 0 ? `, ${pending} pendientes` : ''}`,
    };
  }

  /**
   * GET /api/invites/stats/:callId
   * 
   * Obtiene estadísticas de envío de invitaciones para una convocatoria.
   * Útil para mostrar en el frontend cuántas invitaciones quedan pendientes.
   * 
   * @param callId - UUID de la convocatoria
   * @returns Objeto con:
   *   - total: Total de invitaciones creadas
   *   - sent: Cantidad de invitaciones enviadas
   *   - pending: Cantidad de invitaciones pendientes de envío
   *   - used: Cantidad de invitaciones usadas por postulantes
   *   - lastSentAt: Fecha del último envío (opcional)
   * 
   * @example
   * GET /api/invites/stats/uuid-call-id
   * // { total: 100, sent: 40, pending: 60, used: 35, lastSentAt: "2025-12-16T10:30:00Z" }
   */
  @Get('stats/:callId')
  async getStats(@Param('callId') callId: string) {
    const stats = await this.ds.query(
      `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN email_sent = true THEN 1 END) as sent,
        COUNT(CASE WHEN email_sent = false THEN 1 END) as pending,
        COUNT(CASE WHEN used_at IS NOT NULL THEN 1 END) as used,
        MAX(sent_at) as "lastSentAt"
      FROM invites
      WHERE call_id = $1
      `,
      [callId],
    );

    const result = stats[0];
    return {
      total: parseInt(result.total, 10),
      sent: parseInt(result.sent, 10),
      pending: parseInt(result.pending, 10),
      used: parseInt(result.used, 10),
      lastSentAt: result.lastSentAt || null,
    };
  }

  /**
   * Hashea un código de invitación usando argon2.
   * Método auxiliar para regenerar códigos pendientes.
   */
  private async hashCode(code: string): Promise<string> {
    const argon2 = require('argon2');
    return argon2.hash(code.toUpperCase());
  }
}
