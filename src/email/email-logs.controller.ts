import { Controller, Get, Query } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Roles } from '../auth/roles.decorator';

@Controller('email/logs')
@Roles('ADMIN')
export class EmailLogsController {
  constructor(private ds: DataSource) {}

  // GET /api/email/logs - Lista de logs de email
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
        to_address as "recipient",
        template_key as "templateKey",
        status,
        error_message as "errorMessage",
        sent_at as "sentAt",
        created_at as "createdAt"
      FROM email_logs
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const data = await this.ds.query(query, [limitNum, offsetNum]);

    let total: number | undefined;
    if (needCount) {
      const countResult = await this.ds.query(
        `SELECT COUNT(*) as count FROM email_logs`,
      );
      total = parseInt(countResult[0].count, 10);
    }

    return { data, total, limit: limitNum, offset: offsetNum };
  }
}
