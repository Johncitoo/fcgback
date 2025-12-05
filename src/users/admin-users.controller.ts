import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';

@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private users: UsersService,
    private ds: DataSource,
  ) {}

  // POST /api/admin/users - Crear nuevo usuario (ADMIN/REVIEWER)
  @Post()
  async create(
    @Body()
    body: {
      email: string;
      fullName: string;
      role: 'ADMIN' | 'REVIEWER' | 'APPLICANT';
      password?: string;
      isActive?: boolean;
    },
  ) {
    if (!body.email || !body.fullName || !body.role) {
      throw new BadRequestException('Email, fullName and role are required');
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
