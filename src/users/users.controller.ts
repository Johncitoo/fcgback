import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  BadRequestException,
  Req,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Controller('applicants')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private users: UsersService,
    private ds: DataSource,
    private jwt: JwtService,
    private cfg: ConfigService,
  ) {}

  // GET /api/applicants - Lista de postulantes con paginación
  @Get()
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('count') count?: string,
    @Query('callId') callId?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    const needCount = count === '1' || count === 'true';

    const conditions: string[] = ['u.role = \'APPLICANT\''];
    const values: any[] = [];
    let idx = 1;

    if (callId) {
      conditions.push(`EXISTS (SELECT 1 FROM applications app WHERE app.applicant_id = u.applicant_id AND app.call_id = $${idx++})`);
      values.push(callId);
    }

    values.push(limitNum, offsetNum);

    const query = `
      SELECT 
        u.id,
        u.email,
        u.full_name as "fullName",
        u.created_at as "createdAt",
        u.last_login_at as "lastLoginAt",
        u.is_active as "isActive",
        u.applicant_id as "applicantId",
        a.rut_number as "rutNumber",
        a.rut_dv as "rutDv",
        a.first_name as "firstName",
        a.last_name as "lastName",
        a.phone,
        a.birth_date as "birthDate",
        a.address,
        a.commune,
        a.region,
        i.name as "institutionName",
        i.commune as "institutionCommune"
      FROM users u
      LEFT JOIN applicants a ON a.id = u.applicant_id
      LEFT JOIN institutions i ON i.id = a.institution_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY u.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    const data = await this.ds.query(query, values);

    let total: number | undefined;
    if (needCount) {
      const countQuery = `SELECT COUNT(*) as count FROM users u WHERE ${conditions.join(' AND ')}`;
      const countResult = await this.ds.query(countQuery, values.slice(0, -2));
      total = parseInt(countResult[0].count, 10);
    }

    return { data, total, limit: limitNum, offset: offsetNum };
  }

  // GET /api/applicants/me - Obtener perfil del postulante autenticado
  @Get('me')
  async getMe(@Req() req: any) {
    try {
      this.logger.log('GET /applicants/me - Iniciando...');
      
      // Extraer y verificar JWT
      const hdr = req.headers?.authorization ?? '';
      const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
      if (!token) {
        this.logger.warn('No bearer token provided');
        throw new UnauthorizedException('Missing bearer token');
      }

      const secret = this.cfg.get<string>('AUTH_JWT_SECRET');
      if (!secret) {
        this.logger.error('AUTH_JWT_SECRET not configured');
        throw new Error('JWT secret not configured');
      }

      const user = this.jwt.verify(token, {
        secret,
        ignoreExpiration: false,
      }) as { sub: string; role: string; typ: string };
      
      this.logger.log(`Usuario autenticado: ${user.sub}, role: ${user.role}`);
      
      if (user.role !== 'APPLICANT') {
        this.logger.warn(`Usuario no es APPLICANT: ${user.role}`);
        throw new UnauthorizedException('Applicant access required');
      }

      // Buscar el applicant_id del usuario
      this.logger.log(`Buscando applicant_id para user: ${user.sub}`);
      const userResult = await this.ds.query(
        'SELECT applicant_id FROM users WHERE id = $1',
        [user.sub],
      );

      if (!userResult || userResult.length === 0 || !userResult[0].applicant_id) {
        this.logger.error(`No se encontró applicant_id para user: ${user.sub}`);
        throw new UnauthorizedException('Applicant not found');
      }

      const applicantId = userResult[0].applicant_id;
      this.logger.log(`applicant_id encontrado: ${applicantId}`);

      // Obtener datos del applicant
      const applicantResult = await this.ds.query(
        `SELECT id, email, first_name, last_name, phone, rut_number, rut_dv, 
                birth_date, address, commune, region, institution_id
         FROM applicants 
         WHERE id = $1`,
        [applicantId],
      );

      if (!applicantResult || applicantResult.length === 0) {
        this.logger.error(`No se encontró applicant con id: ${applicantId}`);
        throw new UnauthorizedException('Applicant profile not found');
      }

      this.logger.log('✅ Applicant encontrado, retornando datos');
      return applicantResult[0];
    } catch (error: any) {
      this.logger.error(`Error en GET /applicants/me: ${error.message}`, error.stack);
      throw error;
    }
  }

  // POST /api/applicants - Crear nuevo postulante
  @Post()
  async create(
    @Body() body: {
      email: string;
      fullName?: string;
      first_name?: string;
      last_name?: string;
      rut?: string;
      phone?: string;
      birth_date?: string;
      address?: string;
      commune?: string;
      region?: string;
      institution_id?: string;
      call_id?: string;
      password?: string;
    },
  ) {
    if (!body.email) {
      throw new BadRequestException('Email is required');
    }

    const existing = await this.users.findByEmail(body.email);
    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    // Parsear RUT si viene, o generar uno temporal único
    let rutNumber: number;
    let rutDv: string;
    
    if (body.rut && body.rut.trim() !== '') {
      const parts = body.rut.replace(/\./g, '').split('-');
      if (parts.length === 2) {
        rutNumber = parseInt(parts[0], 10);
        rutDv = parts[1].toUpperCase();
      } else {
        // RUT inválido, generar uno temporal
        rutNumber = Math.floor(Math.random() * 90000000) + 10000000;
        rutDv = String(Math.floor(Math.random() * 10));
      }
    } else {
      // Generar RUT temporal único usando timestamp + random
      const timestamp = Date.now().toString().slice(-8);
      const random = Math.floor(Math.random() * 1000);
      rutNumber = parseInt(timestamp + random.toString().padStart(3, '0').slice(-3));
      rutDv = String(rutNumber % 11);
    }

    // Verificar que el RUT no exista (por si acaso)
    const existingRut = await this.ds.query(
      'SELECT id FROM applicants WHERE rut_number = $1 AND rut_dv = $2',
      [rutNumber, rutDv],
    );
    
    if (existingRut && existingRut.length > 0) {
      // Si existe, agregar más aleatoriedad
      rutNumber = rutNumber + Math.floor(Math.random() * 10000);
      rutDv = String(rutNumber % 11);
    }

    // Insertar en applicants
    const applicantResult = await this.ds.query(
      `INSERT INTO applicants (
        rut_number, rut_dv, first_name, last_name, email, phone,
        birth_date, address, commune, region, institution_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        rutNumber,
        rutDv,
        body.first_name || null,
        body.last_name || null,
        body.email,
        body.phone || null,
        body.birth_date || null,
        body.address || null,
        body.commune || null,
        body.region || null,
        body.institution_id || null,
      ],
    );

    const applicantId = applicantResult[0].id;

    // Generar password temporal si no se provee
    const password = body.password || Math.random().toString(36).slice(-8);
    const argon2 = await import('argon2');
    const hash = await argon2.hash(password, { type: argon2.argon2id });

    // Crear usuario
    const fullName = body.fullName || `${body.first_name || ''} ${body.last_name || ''}`.trim() || body.email;
    const user = await this.users.createApplicantUser(
      body.email,
      fullName,
      hash,
    );

    // Actualizar applicant_id en users
    await this.ds.query(
      `UPDATE users SET applicant_id = $1 WHERE id = $2`,
      [applicantId, user.id],
    );

    // Si se proporciona call_id, crear automáticamente una application
    if (body.call_id) {
      await this.ds.query(
        `INSERT INTO applications (applicant_id, call_id, institution_id, status)
         VALUES ($1, $2, $3, 'DRAFT')
         ON CONFLICT (applicant_id, call_id) DO NOTHING`,
        [applicantId, body.call_id, body.institution_id || null],
      );
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      applicantId,
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
