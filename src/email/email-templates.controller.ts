import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Roles } from '../auth/roles.decorator';

@Controller('email/templates')
@Roles('ADMIN')
export class EmailTemplatesController {
  constructor(private ds: DataSource) {}

  // GET /api/email/templates - Lista de templates
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
        id,
        key,
        name,
        subject_tpl as "subjectTemplate",
        body_tpl as "bodyTemplate",
        created_at as "createdAt"
      FROM email_templates
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const data = await this.ds.query(query, [limitNum, offsetNum]);

    let total: number | undefined;
    if (needCount) {
      const countResult = await this.ds.query(
        `SELECT COUNT(*) as count FROM email_templates`,
      );
      total = parseInt(countResult[0].count, 10);
    }

    return { data, total, limit: limitNum, offset: offsetNum };
  }

  // POST /api/email/templates - Crear template
  @Post()
  async create(
    @Body()
    body: {
      key: string;
      name: string;
      subjectTemplate: string;
      bodyTemplate: string;
    },
  ) {
    if (
      !body.key ||
      !body.name ||
      !body.subjectTemplate ||
      !body.bodyTemplate
    ) {
      throw new BadRequestException(
        'key, name, subjectTemplate, and bodyTemplate are required',
      );
    }

    const result = await this.ds.query(
      `
      INSERT INTO email_templates (id, key, name, subject_tpl, body_tpl)
      VALUES (gen_random_uuid(), $1, $2, $3, $4)
      RETURNING id, key, name, subject_tpl as "subjectTemplate", body_tpl as "bodyTemplate", created_at as "createdAt"
      `,
      [body.key, body.name, body.subjectTemplate, body.bodyTemplate],
    );

    return result[0];
  }

  // GET /api/email/templates/:id - Obtener template
  @Get(':id')
  async getById(@Param('id') id: string) {
    const result = await this.ds.query(
      `
      SELECT 
        id,
        key,
        name,
        subject_tpl as "subjectTemplate",
        body_tpl as "bodyTemplate",
        created_at as "createdAt"
      FROM email_templates
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    if (!result || result.length === 0) {
      throw new BadRequestException('Template not found');
    }

    return result[0];
  }

  // PATCH /api/email/templates/:id - Actualizar template
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (body.key !== undefined) {
      fields.push(`key = $${idx++}`);
      values.push(body.key);
    }

    if (body.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(body.name);
    }

    if (body.subjectTemplate !== undefined) {
      fields.push(`subject_tpl = $${idx++}`);
      values.push(body.subjectTemplate);
    }

    if (body.bodyTemplate !== undefined) {
      fields.push(`body_tpl = $${idx++}`);
      values.push(body.bodyTemplate);
    }

    if (fields.length === 0) {
      return { ok: true, updated: false };
    }

    values.push(id);
    const sql = `UPDATE email_templates SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id`;
    const result = await this.ds.query(sql, values);

    if (!result || result.length === 0) {
      throw new BadRequestException('Template not found');
    }

    return { ok: true, updated: true };
  }
}
