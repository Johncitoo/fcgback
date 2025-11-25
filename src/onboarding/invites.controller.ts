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
      code: string;
      ttlDays?: number;
      institutionId?: string;
      email?: string;
    },
  ) {
    if (!body.callId || !body.code) {
      throw new BadRequestException('callId and code are required');
    }

    return this.onboarding.devCreateInvite(
      body.callId,
      body.code,
      body.ttlDays,
      body.institutionId,
    );
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
