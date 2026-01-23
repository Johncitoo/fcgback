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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../auth/roles.decorator';
import { AuditService } from '../common/audit.service';

/**
 * Controller para gestión de usuarios postulantes (applicants).
 * 
 * Proporciona endpoints CRUD para administrar postulantes:
 * - Listar con filtros y paginación
 * - Crear nuevos postulantes con perfil inicial
 * - Actualizar datos de perfil
 * - Obtener información individual
 * - Eliminar (soft delete) postulantes
 * 
 * Incluye endpoint /me para que postulantes obtengan su propio perfil.
 * Los demás endpoints requieren rol ADMIN o REVIEWER.
 * 
 * @path /applicants
 * @roles ADMIN, REVIEWER (mayoría de endpoints), APPLICANT solo para /me
 */
@ApiTags('Applicants')
@ApiBearerAuth('JWT-auth')
@Controller('applicants')
@Roles('ADMIN', 'REVIEWER')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private users: UsersService,
    private ds: DataSource,
    private jwt: JwtService,
    private cfg: ConfigService,
    private auditService: AuditService,
  ) {}

  /**
   * Lista todos los usuarios postulantes con paginación y filtros.
   * Incluye información del perfil de applicant e institución asociada.
   * 
   * @param limit - Número máximo de resultados (default: 20)
   * @param offset - Desplazamiento para paginación (default: 0)
   * @param count - Si debe incluir el conteo total ('1' o 'true')
   * @param callId - Filtro opcional por convocatoria específica
   * @returns Lista paginada de postulantes con metadata
   * 
   * @example
   * GET /api/applicants?limit=10&count=1&callId=uuid-123
   */
  @Get()
  @ApiOperation({ summary: 'Listar postulantes', description: 'Lista postulantes con paginación y filtros opcionales' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'count', required: false, type: String, description: 'Incluir conteo total' })
  @ApiQuery({ name: 'callId', required: false, type: String, description: 'Filtrar por convocatoria' })
  @ApiResponse({ status: 200, description: 'Lista paginada de postulantes' })
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

  /**
   * Obtiene el perfil completo del postulante autenticado.
   * Valida el token JWT y retorna datos del applicant.
   * 
   * @param req - Request con token JWT del postulante
   * @returns Perfil completo del applicant (email, nombre, RUT, dirección, etc.)
   * @throws {UnauthorizedException} Si el token es inválido o no es APPLICANT
   * 
   * @example
   * GET /api/applicants/me
   * Response: { "id": "uuid", "email": "user@example.com", "first_name": "Juan", ... }
   */
  @Get('me')
  @Roles('APPLICANT')
  @ApiOperation({ summary: 'Obtener mi perfil', description: 'Retorna perfil completo del postulante autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil del postulante' })
  @ApiResponse({ status: 401, description: 'Token inválido o no es APPLICANT' })
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

  /**
   * Crea un nuevo usuario postulante con su perfil de applicant.
   * Genera RUT temporal si no se proporciona y puede crear automáticamente una application.
   * 
   * @param body - Datos del postulante (email requerido, demás campos opcionales)
   * @returns Usuario creado con applicantId y contraseña temporal si fue generada
   * @throws {BadRequestException} Si el email ya existe o es inválido
   * 
   * @example
   * POST /api/applicants
   * Body: { "email": "nuevo@example.com", "first_name": "Juan", "call_id": "uuid-call" }
   * Response: { "id": "uuid", "email": "nuevo@example.com", "temporaryPassword": "abc123" }
   */
  @Post()
  @ApiOperation({ summary: 'Crear postulante', description: 'Crea nuevo postulante con perfil y opcionalmente una application' })
  @ApiResponse({ status: 201, description: 'Postulante creado con su perfil' })
  @ApiResponse({ status: 400, description: 'Email ya existe o datos inválidos' })
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
      this.logger.error('[CREATE APPLICANT] RUT recibido: ' + body.rut);
      const parts = body.rut.replace(/\./g, '').split('-');
      this.logger.error('[CREATE APPLICANT] RUT parseado: ' + JSON.stringify(parts));
      if (parts.length === 2) {
        rutNumber = parseInt(parts[0], 10);
        rutDv = parts[1].toUpperCase();
        this.logger.error('[CREATE APPLICANT] RUT final: ' + JSON.stringify({ rutNumber, rutDv }));
      } else {
        // RUT inválido, generar uno temporal
        this.logger.error('[CREATE APPLICANT] RUT inválido, generando aleatorio');
        rutNumber = Math.floor(Math.random() * 90000000) + 10000000;
        rutDv = String(Math.floor(Math.random() * 10));
      }
    } else {
      // Generar RUT temporal único usando timestamp + random
      this.logger.error('[CREATE APPLICANT] Sin RUT, generando aleatorio');
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
        id, rut_number, rut_dv, first_name, last_name, email, phone,
        birth_date, address, commune, region, institution_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id`,
      [
        uuidv4(),
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
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash(password, 10);

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

    // Registrar creación en auditoría (el actorId vendrá del contexto del request)
    await this.auditService.logUserCreated(
      user.id,
      'APPLICANT',
      user.email,
      undefined, // TODO: extraer actorId del request context
    );

    // Si se proporciona call_id, crear automáticamente una application
    if (body.call_id) {
      await this.ds.query(
        `INSERT INTO applications (id, applicant_id, call_id, institution_id, status)
         VALUES ($1, $2, $3, $4, 'DRAFT')
         ON CONFLICT (applicant_id, call_id) DO NOTHING`,
        [uuidv4(), applicantId, body.call_id, body.institution_id || null],
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

  /**
   * Obtiene los detalles completos de un postulante específico.
   * Incluye información del usuario y lista de aplicaciones.
   * 
   * @param id - ID del usuario postulante
   * @returns Detalles del postulante con sus aplicaciones
   * @throws {BadRequestException} Si el postulante no existe
   * 
   * @example
   * GET /api/applicants/uuid-123
   * Response: { "id": "uuid", "email": "user@example.com", "applications": [...] }
   */
  @Get(':id')
  @ApiOperation({ summary: 'Obtener postulante', description: 'Obtiene detalles completos de un postulante con sus aplicaciones' })
  @ApiParam({ name: 'id', description: 'ID del usuario postulante' })
  @ApiResponse({ status: 200, description: 'Detalles del postulante' })
  @ApiResponse({ status: 400, description: 'Postulante no encontrado' })
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

  /**
   * Actualiza parcialmente los datos de un postulante.
   * Actualiza tanto la tabla users como applicants según los campos proporcionados.
   * 
   * @param id - ID del usuario postulante
   * @param body - Campos a actualizar (fullName, isActive, datos de applicant)
   * @returns Confirmación de actualización
   * @throws {BadRequestException} Si el postulante no existe
   * 
   * @example
   * PATCH /api/applicants/uuid-123
   * Body: { "fullName": "Juan Pérez", "phone": "+56912345678" }
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar postulante', description: 'Actualiza parcialmente datos de usuario y perfil de applicant' })
  @ApiParam({ name: 'id', description: 'ID del usuario postulante' })
  @ApiResponse({ status: 200, description: 'Postulante actualizado' })
  @ApiResponse({ status: 400, description: 'Postulante no encontrado' })
  async update(@Param('id') id: string, @Body() body: UpdateUserDto) {
    const user = await this.users.findById(id);
    if (!user || user.role !== 'APPLICANT') {
      throw new BadRequestException('Applicant not found');
    }

    // Actualizar tabla users
    const userFields: string[] = [];
    const userValues: any[] = [];
    let userIdx = 1;

    if (body.fullName !== undefined) {
      userFields.push(`full_name = $${userIdx++}`);
      userValues.push(body.fullName);
    }

    if (body.isActive !== undefined) {
      userFields.push(`is_active = $${userIdx++}`);
      userValues.push(body.isActive);
    }

    if (userFields.length > 0) {
      userValues.push(id);
      const userSql = `UPDATE users SET ${userFields.join(', ')}, updated_at = NOW() WHERE id = $${userIdx}`;
      await this.ds.query(userSql, userValues);
    }

    // Actualizar tabla applicants si hay applicant_id
    if (user.applicantId) {
      const appFields: string[] = [];
      const appValues: any[] = [];
      let appIdx = 1;

      if (body.first_name !== undefined) {
        appFields.push(`first_name = $${appIdx++}`);
        appValues.push(body.first_name);
      }

      if (body.last_name !== undefined) {
        appFields.push(`last_name = $${appIdx++}`);
        appValues.push(body.last_name);
      }

      if (body.rut !== undefined && body.rut !== null) {
        // Parsear RUT
        const parts = body.rut.replace(/\./g, '').split('-');
        if (parts.length === 2) {
          appFields.push(`rut_number = $${appIdx++}`);
          appValues.push(parseInt(parts[0], 10));
          appFields.push(`rut_dv = $${appIdx++}`);
          appValues.push(parts[1].toUpperCase());
        }
      }

      if (body.phone !== undefined) {
        appFields.push(`phone = $${appIdx++}`);
        appValues.push(body.phone || null);
      }

      if (body.birth_date !== undefined) {
        appFields.push(`birth_date = $${appIdx++}`);
        appValues.push(body.birth_date || null);
      }

      if (body.address !== undefined) {
        appFields.push(`address = $${appIdx++}`);
        appValues.push(body.address || null);
      }

      if (body.commune !== undefined) {
        appFields.push(`commune = $${appIdx++}`);
        appValues.push(body.commune || null);
      }

      if (body.region !== undefined) {
        appFields.push(`region = $${appIdx++}`);
        appValues.push(body.region || null);
      }

      if (body.institution_id !== undefined) {
        appFields.push(`institution_id = $${appIdx++}`);
        appValues.push(body.institution_id || null);
      }

      if (appFields.length > 0) {
        appValues.push(user.applicantId);
        const appSql = `UPDATE applicants SET ${appFields.join(', ')}, updated_at = NOW() WHERE id = $${appIdx}`;
        await this.ds.query(appSql, appValues);
      }
    }

    return { ok: true, updated: true };
  }
}
