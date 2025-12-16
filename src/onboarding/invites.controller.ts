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
        i.code_hash as "code_hash",
        c.name as "callName",
        c.year as "callYear"
      FROM invites i
      LEFT JOIN calls c ON c.id = i.call_id
      ${whereClause}
      ORDER BY i.created_at DESC
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
   * Envío masivo de invitaciones a postulantes sin invitar.
   * 
   * Modos de operación:
   * 1. sendToAll = true: Envía a TODOS los postulantes sin invitación previa en callId
   * 2. applicantIds: Envía solo a IDs especificados
   * 
   * Lógica:
   * - Filtra postulantes que NO tienen invitación en esta convocatoria
   * - Genera código único para cada uno
   * - Crea invitación en BD
   * - Envía email con código
   * - Reporta exitosos y fallidos
   * 
   * @param body - Objeto con:
   *   - callId (requerido): ID de la convocatoria
   *   - sendToAll (opcional): Si true, envía a todos sin invitar
   *   - applicantIds (opcional): Lista de IDs específicos
   * @returns Objeto con sent, failed, total, errors (opcional), message
   * @throws BadRequestException si falta callId
   */
  @Post('bulk-send')
  async bulkSend(
    @Body()
    body: {
      callId: string;
      sendToAll?: boolean; // Si true, envía a TODOS los postulantes sin invitar
      applicantIds?: string[]; // O lista específica de IDs
    },
  ) {
    if (!body.callId) {
      throw new BadRequestException('callId is required');
    }

    // Obtener postulantes que no han sido invitados a esta convocatoria
    let applicantIds = body.applicantIds || [];

    if (body.sendToAll || applicantIds.length === 0) {
      // Buscar todos los postulantes que no tienen invitación para esta convocatoria
      const result = await this.ds.query(
        `
        SELECT DISTINCT a.id, u.email, a.first_name, a.last_name
        FROM applicants a
        INNER JOIN users u ON u.applicant_id = a.id
        WHERE NOT EXISTS (
          SELECT 1 FROM invites i 
          WHERE i.call_id = $1 
          AND (i.meta->>'email')::text = u.email
        )
        AND u.is_active = true
        ORDER BY a.created_at DESC
        `,
        [body.callId],
      );

      applicantIds = result.map((r: any) => r.id);
    }

    if (applicantIds.length === 0) {
      return {
        success: true,
        sent: 0,
        failed: 0,
        message: 'No hay postulantes sin invitar',
      };
    }

    // Obtener datos completos de los postulantes
    const applicants = await this.ds.query(
      `
      SELECT a.id, u.email, a.first_name as "firstName", a.last_name as "lastName"
      FROM applicants a
      INNER JOIN users u ON u.applicant_id = a.id
      WHERE a.id = ANY($1)
      AND u.is_active = true
      `,
      [applicantIds],
    );

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Enviar invitaciones una por una
    for (const applicant of applicants) {
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

        await this.onboarding.sendInitialInvite(
          invite.id,
          applicant.email,
          code,
          applicant.firstName,
          applicant.lastName,
        );

        results.sent++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`${applicant.email}: ${err.message || 'Error desconocido'}`);
      }
    }

    return {
      success: true,
      sent: results.sent,
      failed: results.failed,
      total: applicants.length,
      errors: results.errors.length > 0 ? results.errors : undefined,
      message: `${results.sent} invitaciones enviadas, ${results.failed} fallidas`,
    };
  }
}
