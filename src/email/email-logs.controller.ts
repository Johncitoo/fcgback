import { Controller, Get, Query } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Roles } from '../auth/roles.decorator';

/**
 * Controlador para consultar logs de emails enviados.
 * 
 * Proporciona historial de emails con:
 * - Destinatario
 * - Plantilla usada
 * - Estado (sent/failed)
 * - Mensaje de error (si aplica)
 * - Fecha de envío
 * 
 * Seguridad: ADMIN y REVIEWER
 */
@Controller('email/logs')
@Roles('ADMIN', 'REVIEWER')
export class EmailLogsController {
  constructor(private ds: DataSource) {}

  /**
   * GET /api/email/logs
   * 
   * Lista logs de emails enviados con paginación.
   * Ordenados por fecha de creación descendente (más recientes primero).
   * 
   * @param limit - Cantidad de resultados (default: 20)
   * @param offset - Desplazamiento para paginación (default: 0)
   * @param count - Si es '1' o 'true', incluye total de registros
   * @returns Objeto con data (array de logs), total (opcional), limit, offset
   */
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
