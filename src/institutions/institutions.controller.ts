import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Roles } from '../auth/roles.decorator';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';

@Controller('institutions')
export class InstitutionsController {
  constructor(private ds: DataSource) {}

  /**
   * Lista todas las instituciones educacionales con filtros y paginación.
   * 
   * @param limit - Número máximo de resultados (default: 100)
   * @param offset - Desplazamiento para paginación (default: 0)
   * @param q - Búsqueda por nombre o código (ILIKE)
   * @param active - Filtro por instituciones activas ('true' o '1')
   * @returns Lista paginada de instituciones con metadata
   * 
   * @example
   * GET /api/institutions?limit=20&q=santiago&active=true
   */
  @Roles('ADMIN', 'REVIEWER')
  @Get()
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('q') q?: string,
    @Query('active') active?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    const offsetNum = offset ? parseInt(offset, 10) : 0;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (q) {
      conditions.push(`(i.name ILIKE $${idx} OR i.code ILIKE $${idx})`);
      values.push(`%${q}%`);
      idx++;
    }

    if (active === 'true' || active === '1') {
      conditions.push(`i.active = true`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    values.push(limitNum, offsetNum);

    const query = `
      SELECT 
        i.id,
        i.name,
        i.code,
        i.commune,
        i.province,
        i.region,
        i.type,
        i.email,
        i.phone,
        i.address,
        i.director_name as "directorName",
        i.website,
        i.notes,
        i.active,
        i.created_at as "createdAt",
        i.updated_at as "updatedAt"
      FROM institutions i
      ${whereClause}
      ORDER BY i.name ASC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    const data = await this.ds.query(query, values);

    const countQuery = `SELECT COUNT(*) as count FROM institutions i ${whereClause}`;
    const countResult = await this.ds.query(
      countQuery,
      values.slice(0, values.length - 2),
    );
    const total = parseInt(countResult[0].count, 10);

    return { data, total, limit: limitNum, offset: offsetNum };
  }

  /**
   * Crea una nueva institución educacional.
   * 
   * @param body - Datos de la institución (name requerido, type debe ser LICEO/COLEGIO/INSTITUTO/OTRO)
   * @returns Institución creada con todos sus campos
   * @throws {BadRequestException} Si falta el nombre o el tipo es inválido
   * 
   * @example
   * POST /api/institutions
   * Body: { "name": "Liceo A-1", "type": "LICEO", "commune": "Santiago" }
   */
  @Roles('ADMIN', 'REVIEWER')
  @Post()
  async create(@Body() body: CreateInstitutionDto) {
    if (!body.name) {
      throw new BadRequestException('Name is required');
    }

    const type = body.type || 'LICEO';
    const validTypes = ['LICEO', 'COLEGIO', 'INSTITUTO', 'OTRO'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException('Invalid type');
    }

    const result = await this.ds.query(
      `INSERT INTO institutions (
        name, code, commune, province, region, type,
        email, phone, address, director_name, website, notes
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        body.name,
        body.code || null,
        body.commune || null,
        body.province || null,
        body.region || null,
        type,
        body.email || null,
        body.phone || null,
        body.address || null,
        body.director_name || null,
        body.website || null,
        body.notes || null,
      ],
    );

    return result[0];
  }

  /**
   * Obtiene los detalles completos de una institución específica.
   * 
   * @param id - ID de la institución
   * @returns Institución con todos sus campos
   * @throws {BadRequestException} Si la institución no existe
   * 
   * @example
   * GET /api/institutions/uuid-123
   */
  @Roles('ADMIN', 'REVIEWER')
  @Get(':id')
  async getById(@Param('id') id: string) {
    const result = await this.ds.query(
      `SELECT * FROM institutions WHERE id = $1`,
      [id],
    );

    if (!result || result.length === 0) {
      throw new BadRequestException('Institution not found');
    }

    return result[0];
  }

  /**
   * Actualiza parcialmente los datos de una institución.
   * 
   * @param id - ID de la institución
   * @param body - Campos a actualizar
   * @returns Institución actualizada
   * @throws {BadRequestException} Si la institución no existe o el tipo es inválido
   * 
   * @example
   * PATCH /api/institutions/uuid-123
   * Body: { "email": "contacto@liceo.cl", "active": true }
   */
  @Roles('ADMIN', 'REVIEWER')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateInstitutionDto) {
    const existing = await this.ds.query(
      'SELECT id FROM institutions WHERE id = $1',
      [id],
    );

    if (!existing || existing.length === 0) {
      throw new BadRequestException('Institution not found');
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (body.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(body.name);
    }
    if (body.code !== undefined) {
      fields.push(`code = $${idx++}`);
      values.push(body.code || null);
    }
    if (body.commune !== undefined) {
      fields.push(`commune = $${idx++}`);
      values.push(body.commune || null);
    }
    if (body.province !== undefined) {
      fields.push(`province = $${idx++}`);
      values.push(body.province || null);
    }
    if (body.region !== undefined) {
      fields.push(`region = $${idx++}`);
      values.push(body.region || null);
    }
    if (body.type !== undefined) {
      const validTypes = ['LICEO', 'COLEGIO', 'INSTITUTO', 'OTRO'];
      if (!validTypes.includes(body.type)) {
        throw new BadRequestException('Invalid type');
      }
      fields.push(`type = $${idx++}`);
      values.push(body.type);
    }
    if (body.email !== undefined) {
      fields.push(`email = $${idx++}`);
      values.push(body.email || null);
    }
    if (body.phone !== undefined) {
      fields.push(`phone = $${idx++}`);
      values.push(body.phone || null);
    }
    if (body.address !== undefined) {
      fields.push(`address = $${idx++}`);
      values.push(body.address || null);
    }
    if (body.director_name !== undefined) {
      fields.push(`director_name = $${idx++}`);
      values.push(body.director_name || null);
    }
    if (body.website !== undefined) {
      fields.push(`website = $${idx++}`);
      values.push(body.website || null);
    }
    if (body.notes !== undefined) {
      fields.push(`notes = $${idx++}`);
      values.push(body.notes || null);
    }
    if (body.active !== undefined) {
      fields.push(`active = $${idx++}`);
      values.push(body.active);
    }

    if (fields.length === 0) {
      throw new BadRequestException('No fields to update');
    }

    values.push(id);

    const result = await this.ds.query(
      `UPDATE institutions SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${idx}
       RETURNING *`,
      values,
    );

    return result[0];
  }

  /**
   * Desactiva una institución (soft delete).
   * Marca active=false en lugar de eliminar el registro.
   * 
   * @param id - ID de la institución
   * @returns Confirmación de desactivación
   * @throws {BadRequestException} Si la institución no existe
   * 
   * @example
   * DELETE /api/institutions/uuid-123
   */
  @Roles('ADMIN', 'REVIEWER')
  @Delete(':id')
  async delete(@Param('id') id: string) {
    const result = await this.ds.query(
      `UPDATE institutions SET active = false WHERE id = $1 RETURNING *`,
      [id],
    );

    if (!result || result.length === 0) {
      throw new BadRequestException('Institution not found');
    }

    return { success: true, message: 'Institution deactivated' };
  }
}
