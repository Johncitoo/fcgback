import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import { Roles } from '../auth/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/current-user.decorator';
import { Admin2FAService } from './admin-2fa.service';
import { EmailService, EmailCategory } from '../email/email.service';

/**
 * Controller para administración de usuarios por parte de ADMIN.
 * 
 * CRUD completo de usuarios (staff ADMIN/REVIEWER únicamente):
 * - Crear usuarios ADMIN o REVIEWER con contraseña temporal
 * - Listar todos los usuarios del sistema
 * - Actualizar datos y roles
 * - Desactivar/eliminar usuarios (soft delete)
 * 
 * Genera contraseñas temporales seguras para nuevos usuarios.
 * 
 * @path /admin/users
 * @roles ADMIN - Solo administradores pueden gestionar usuarios
 */
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN') // Solo administradores pueden gestionar usuarios
export class AdminUsersController {
  constructor(
    private users: UsersService,
    private ds: DataSource,
    private admin2FA: Admin2FAService,
    private emailService: EmailService,
  ) {}

  /**
   * PASO 1: Solicitar código 2FA para crear usuario
   * 
   * El código se envía al EMAIL del ADMIN que está creando el usuario,
   * NO al email del usuario nuevo.
   * 
   * POST /api/admin/users/request-2fa
   */
  @Post('request-2fa')
  async request2FA(
    @CurrentUser() admin: JwtPayload,
    @Body()
    body: {
      email: string;
      fullName: string;
      role: 'ADMIN' | 'REVIEWER';
      password?: string;
    },
  ) {
    if (!body.email || !body.fullName || !body.role) {
      throw new BadRequestException('Email, fullName and role are required');
    }

    // CRÍTICO: Solo permitir crear ADMIN o REVIEWER, nunca APPLICANT
    if (body.role !== 'ADMIN' && body.role !== 'REVIEWER') {
      throw new BadRequestException(
        'Only ADMIN and REVIEWER roles can be created through this endpoint',
      );
    }

    // Verificar que email no exista
    const existing = await this.users.findByEmail(body.email);
    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    // Generar contraseña temporal si no se provee
    const password = body.password || Math.random().toString(36).slice(-10);

    // Generar código 2FA
    const { code, expiresAt } = await this.admin2FA.requestCode(
      admin.email, // Email del admin que está creando
      'CREATE_USER',
      { ...body, password }, // Guardar datos del usuario a crear
    );

    // Enviar email con código al ADMIN (no al usuario nuevo)
    await this.emailService.sendEmail(
      {
        to: admin.email,
        subject: '🔐 Código de Verificación - Creación de Usuario',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e40af;">Código de Verificación</h2>
            <p>Has solicitado crear un nuevo usuario <strong>${body.role}</strong> en el sistema.</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">Tu código de verificación es:</p>
              <p style="font-size: 32px; font-weight: bold; color: #1e40af; letter-spacing: 8px; margin: 10px 0;">
                ${code}
              </p>
              <p style="margin: 0; color: #6b7280; font-size: 12px;">Este código expira en 10 minutos</p>
            </div>
            
            <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; color: #92400e;"><strong>⚠️ Detalles del usuario a crear:</strong></p>
              <ul style="margin: 10px 0;">
                <li><strong>Email:</strong> ${body.email}</li>
                <li><strong>Nombre:</strong> ${body.fullName}</li>
                <li><strong>Rol:</strong> ${body.role}</li>
              </ul>
            </div>
            
            <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
              Si no solicitaste esto, ignora este correo.
            </p>
          </div>
        `,
        textContent: `
Código de Verificación

Has solicitado crear un nuevo usuario ${body.role} en el sistema.

Tu código de verificación es: ${code}

Este código expira en 10 minutos.

Detalles del usuario a crear:
- Email: ${body.email}
- Nombre: ${body.fullName}
- Rol: ${body.role}

Si no solicitaste esto, ignora este correo.
        `,
      },
      EmailCategory.TRANSACTIONAL,
    );

    return {
      message: 'Código de verificación enviado a tu correo',
      expiresAt,
    };
  }

  /**
   * PASO 2: Crear usuario con código 2FA
   * 
   * POST /api/admin/users/create-with-2fa
   */
  @Post('create-with-2fa')
  async createWith2FA(
    @CurrentUser() admin: JwtPayload,
    @Body() body: { code: string },
  ) {
    if (!body.code || body.code.length !== 6) {
      throw new BadRequestException('Valid 6-digit code is required');
    }

    // Validar y consumir código
    const codeEntity = await this.admin2FA.validateAndConsume(
      admin.email,
      body.code,
      'CREATE_USER',
    );

    if (!codeEntity) {
      throw new BadRequestException('Invalid or expired code');
    }

    // Extraer datos del usuario desde metadata
    const userData = codeEntity.metadata;

    // Encriptar contraseña
    const hash = await argon2.hash(userData.password, { type: argon2.argon2id });

    // Crear usuario
    const result = await this.ds.query(
      `INSERT INTO users (email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name as "fullName", role, is_active as "isActive", created_at as "createdAt"`,
      [userData.email, hash, userData.fullName, userData.role, true],
    );

    return {
      message: `Usuario ${userData.role} creado exitosamente`,
      user: result[0],
      temporaryPassword: userData.password,
    };
  }

  // POST /api/admin/users - Crear nuevo usuario (ADMIN/REVIEWER únicamente)
  @Post()
  async create(
    @Body()
    body: {
      email: string;
      fullName: string;
      role: 'ADMIN' | 'REVIEWER';
      password?: string;
      isActive?: boolean;
    },
  ) {
    if (!body.email || !body.fullName || !body.role) {
      throw new BadRequestException('Email, fullName and role are required');
    }

    // CRÍTICO: Solo permitir crear ADMIN o REVIEWER, nunca APPLICANT
    if (body.role !== 'ADMIN' && body.role !== 'REVIEWER') {
      throw new BadRequestException('Only ADMIN and REVIEWER roles can be created through this endpoint');
    }

    const existing = await this.users.findByEmail(body.email);
    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    // Generar password temporal si no se provee
    const password = body.password || Math.random().toString(36).slice(-10);
    const hash = await argon2.hash(password, { type: argon2.argon2id });

    const isActive = body.isActive !== undefined ? body.isActive : true;

    // Crear usuario
    const result = await this.ds.query(
      `INSERT INTO users (email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name as "fullName", role, is_active as "isActive", created_at as "createdAt"`,
      [body.email, hash, body.fullName, body.role, isActive],
    );

    return {
      ...result[0],
      temporaryPassword: body.password ? undefined : password,
    };
  }

  // GET /api/admin/users - Listar todos los usuarios
  @Get()
  async list() {
    const users = await this.ds.query(
      `SELECT 
        id, 
        email, 
        full_name as "fullName", 
        role, 
        is_active as "isActive",
        applicant_id as "applicantId",
        last_login_at as "lastLoginAt",
        created_at as "createdAt"
       FROM users
       ORDER BY created_at DESC`,
    );

    return { data: users };
  }

  // GET /api/admin/users/:id - Obtener usuario por ID
  @Get(':id')
  async getById(@Param('id') id: string) {
    const result = await this.ds.query(
      `SELECT 
        id, 
        email, 
        full_name as "fullName", 
        role, 
        is_active as "isActive",
        applicant_id as "applicantId",
        last_login_at as "lastLoginAt",
        created_at as "createdAt",
        updated_at as "updatedAt"
       FROM users
       WHERE id = $1`,
      [id],
    );

    if (!result || result.length === 0) {
      throw new BadRequestException('User not found');
    }

    return result[0];
  }

  // PATCH /api/admin/users/:id - Actualizar usuario
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      fullName?: string;
      role?: 'ADMIN' | 'REVIEWER' | 'APPLICANT';
      isActive?: boolean;
      password?: string;
    },
  ) {
    const user = await this.users.findById(id);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (body.fullName !== undefined) {
      fields.push(`full_name = $${idx++}`);
      values.push(body.fullName);
    }

    if (body.role !== undefined) {
      fields.push(`role = $${idx++}`);
      values.push(body.role);
    }

    if (body.isActive !== undefined) {
      fields.push(`is_active = $${idx++}`);
      values.push(body.isActive);
    }

    if (body.password) {
      const hash = await argon2.hash(body.password, { type: argon2.argon2id });
      fields.push(`password_hash = $${idx++}`);
      values.push(hash);
      fields.push(`password_updated_at = NOW()`);
    }

    if (fields.length === 0) {
      return { ok: true, updated: false };
    }

    values.push(id);
    const sql = `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx}`;
    await this.ds.query(sql, values);

    return { ok: true, updated: true };
  }

  // DELETE /api/admin/users/:id - Desactivar usuario (soft delete)
  @Delete(':id')
  async delete(@Param('id') id: string) {
    const user = await this.users.findById(id);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    await this.ds.query(
      `UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id],
    );

    return { ok: true, deleted: true };
  }
}

/**
 * Controller para administración de applicants por parte de ADMIN.
 * 
 * @path /admin/applicants
 * @roles ADMIN, REVIEWER
 */
@Controller('admin/applicants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'REVIEWER')
export class AdminApplicantsController {
  constructor(private ds: DataSource) {}

  // GET /api/admin/applicants/:id - Obtener applicant por ID
  @Get(':id')
  async getById(@Param('id') id: string) {
    const result = await this.ds.query(
      `SELECT 
        a.id,
        a.rut_number as "rutNumber",
        a.rut_dv as "rutDv",
        a.first_name as "firstName",
        a.last_name as "lastName",
        a.full_name as "fullName",
        a.birth_date as "birthDate",
        a.email,
        a.phone,
        a.address,
        a.commune,
        a.region,
        a.institution_id as "institutionId",
        a.created_at as "createdAt",
        a.updated_at as "updatedAt",
        i.name as "institutionName",
        i.commune as "institutionCommune"
       FROM applicants a
       LEFT JOIN institutions i ON i.id = a.institution_id
       WHERE a.id = $1`,
      [id],
    );

    if (!result || result.length === 0) {
      throw new BadRequestException('Applicant not found');
    }

    return result[0];
  }
}
