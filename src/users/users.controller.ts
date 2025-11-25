import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { DataSource } from 'typeorm';

@Controller('applicants')
export class UsersController {
  constructor(
    private users: UsersService,
    private ds: DataSource,
  ) {}

  // GET /api/applicants - Lista de postulantes con paginación
  @Get()
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('count') count?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    const needCount = count === '1' || count === 'true';

    const query = `
      SELECT 
        u.id,
        u.email,
        u.full_name as "fullName",
        u.created_at as "createdAt",
        u.last_login_at as "lastLoginAt",
        u.is_active as "isActive",
        u.applicant_id as "applicantId"
      FROM users u
      WHERE u.role = 'APPLICANT'
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const data = await this.ds.query(query, [limitNum, offsetNum]);

    let total: number | undefined;
    if (needCount) {
      const countResult = await this.ds.query(
        `SELECT COUNT(*) as count FROM users WHERE role = 'APPLICANT'`,
      );
      total = parseInt(countResult[0].count, 10);
    }

    return { data, total, limit: limitNum, offset: offsetNum };
  }

  // POST /api/applicants - Crear nuevo postulante
  @Post()
  async create(
    @Body() body: { email: string; fullName: string; password?: string },
  ) {
    if (!body.email || !body.fullName) {
      throw new BadRequestException('Email and fullName are required');
    }

    const existing = await this.users.findByEmail(body.email);
    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    // Generar password temporal si no se provee
    const password = body.password || Math.random().toString(36).slice(-8);
    const argon2 = await import('argon2');
    const hash = await argon2.hash(password, { type: argon2.argon2id });

    const user = await this.users.createApplicantUser(
      body.email,
      body.fullName,
      hash,
    );

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      createdAt: user.createdAt,
      temporaryPassword: body.password ? undefined : password,
    };
  }

  // GET /api/applicants/:id - Obtener detalles de un postulante
  @Get(':id')
  async getById(@Param('id') id: string) {
    const result = await this.ds.query(
      `
      SELECT 
        u.id,
        u.email,
        u.full_name as "fullName",
        u.created_at as "createdAt",
        u.last_login_at as "lastLoginAt",
        u.is_active as "isActive",
        u.applicant_id as "applicantId"
      FROM users u
      WHERE u.id = $1 AND u.role = 'APPLICANT'
      LIMIT 1
      `,
      [id],
    );

    if (!result || result.length === 0) {
      throw new BadRequestException('Applicant not found');
    }

    // Obtener aplicaciones del postulante
    const applications = await this.ds.query(
      `
      SELECT 
        a.id,
        a.call_id as "callId",
        a.status,
        a.created_at as "createdAt",
        a.submitted_at as "submittedAt",
        c.name as "callName",
        c.year as "callYear"
      FROM applications a
      LEFT JOIN calls c ON c.id = a.call_id
      WHERE a.applicant_id = $1
      ORDER BY a.created_at DESC
      `,
      [result[0].applicantId],
    );

    return { ...result[0], applications };
  }

  // PATCH /api/applicants/:id - Actualizar postulante
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    const user = await this.users.findById(id);
    if (!user || user.role !== 'APPLICANT') {
      throw new BadRequestException('Applicant not found');
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (body.fullName !== undefined) {
      fields.push(`full_name = $${idx++}`);
      values.push(body.fullName);
    }

    if (body.isActive !== undefined) {
      fields.push(`is_active = $${idx++}`);
      values.push(body.isActive);
    }

    if (fields.length === 0) {
      return { ok: true, updated: false };
    }

    values.push(id);
    const sql = `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx}`;
    await this.ds.query(sql, values);

    return { ok: true, updated: true };
  }
}
