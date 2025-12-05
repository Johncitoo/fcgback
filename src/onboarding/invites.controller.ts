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

@Controller('invites')
export class InvitesController {
  constructor(
    private ds: DataSource,
    private onboarding: OnboardingService,
  ) {}

  // GET /api/invites - Lista de invitaciones
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

  // POST /api/invites - Crear nueva invitación
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

  private generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'TEST-';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // GET /api/invites/:id - Obtener detalles de una invitación
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

  // POST /api/invites/:id/regenerate - Regenerar código de invitación
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
}
