import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from '../common/audit.service';
import { Roles } from '../auth/roles.decorator';

/**
 * Controller para consulta de logs de auditoría.
 * 
 * Proporciona acceso a logs históricos de acciones realizadas en el sistema:
 * - Creación, actualización y eliminación de registros
 * - Quién realizó la acción (actor)
 * - Qué entidad fue afectada (entity)
 * - Timestamps y metadatos adicionales
 * 
 * Permite filtrar por acción, entidad, actor y rango de fechas.
 * 
 * @path /audit
 * @roles ADMIN, REVIEWER - Solo staff puede acceder a logs de auditoría
 */
@Controller('audit')
@Roles('ADMIN', 'REVIEWER')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Lista logs de auditoría con filtros opcionales.
   * 
   * Permite búsqueda por tipo de acción, entidad afectada, usuario que realizó la acción
   * y rango de fechas. Retorna resultados paginados.
   * 
   * @param action - Filtro por tipo de acción (CREATE, UPDATE, DELETE, LOGIN, etc.)
   * @param entity - Filtro por tipo de entidad (USER, APPLICATION, FORM, etc.)
   * @param actor - Filtro por ID de usuario que realizó la acción
   * @param from - Fecha de inicio (ISO 8601)
   * @param to - Fecha de fin (ISO 8601)
   * @param limit - Número de resultados por página (default: 20)
   * @param offset - Offset para paginación (default: 0)
   * @returns Lista paginada de logs de auditoría con metadata
   * 
   * @example
   * GET /api/audit?action=DELETE&entity=APPLICATION&from=2024-01-01&limit=50
   */
  @Get()
  async getAuditLogs(
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('actor') actor?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const offsetNum = offset ? parseInt(offset, 10) : 0;

    return this.auditService.getAuditLogs({
      action,
      entity,
      actor,
      from,
      to,
      limit: limitNum,
      offset: offsetNum,
    });
  }
}
