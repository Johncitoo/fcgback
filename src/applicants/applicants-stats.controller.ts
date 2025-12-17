import { Controller, Get, Param } from '@nestjs/common';
import { ApplicantsStatsService } from './applicants.service';
import { Roles } from '../auth/roles.decorator';

/**
 * Controller para estadísticas de postulantes (applicants).
 * 
 * Proporciona endpoints de análisis basados en datos reales de la entidad applicants:
 * - Distribución geográfica (comunas y regiones)
 * - Distribución por edad
 * - Completitud de datos de contacto
 * - Lista de postulantes
 * 
 * @path /admin/applicants-stats
 * @roles ADMIN, REVIEWER - Solo staff puede acceder a estadísticas
 */
@Controller('admin/applicants-stats')
@Roles('ADMIN', 'REVIEWER')
export class ApplicantsStatsController {
  constructor(private stats: ApplicantsStatsService) {}

  /**
   * Obtiene las 10 comunas con más postulantes en una convocatoria.
   * 
   * @param callId - ID de la convocatoria
   * @returns Array de comunas con conteo de postulantes
   * 
   * @example
   * GET /api/admin/applicants-stats/uuid-call-123/communes
   */
  @Get(':callId/communes')
  async getTopCommunes(@Param('callId') callId: string) {
    return this.stats.getTopCommunesByCall(callId);
  }

  /**
   * Obtiene las regiones con más postulantes en una convocatoria.
   * 
   * @param callId - ID de la convocatoria
   * @returns Array de regiones con conteo de postulantes
   * 
   * @example
   * GET /api/admin/applicants-stats/uuid-call-123/regions
   */
  @Get(':callId/regions')
  async getTopRegions(@Param('callId') callId: string) {
    return this.stats.getTopRegionsByCall(callId);
  }

  /**
   * Obtiene la distribución por rango de edad de postulantes.
   * 
   * @param callId - ID de la convocatoria
   * @returns Array con conteo por rango etario
   * 
   * @example
   * GET /api/admin/applicants-stats/uuid-call-123/age-distribution
   */
  @Get(':callId/age-distribution')
  async getAgeDistribution(@Param('callId') callId: string) {
    return this.stats.getAgeDistributionByCall(callId);
  }

  /**
   * Obtiene estadísticas de completitud de datos de contacto.
   * 
   * Retorna cuántos postulantes tienen datos completos de:
   * - Email
   * - Teléfono
   * - Dirección
   * - Comuna
   * - Región
   * - Fecha de nacimiento
   * 
   * @param callId - ID de la convocatoria
   * @returns Objeto con conteos de campos completados
   * 
   * @example
   * GET /api/admin/applicants-stats/uuid-call-123/contact-completeness
   */
  @Get(':callId/contact-completeness')
  async getContactCompleteness(@Param('callId') callId: string) {
    return this.stats.getContactCompleteness(callId);
  }

  /**
   * Obtiene lista de postulantes con datos básicos.
   * 
   * @param callId - ID de la convocatoria
   * @returns Array de los 10 postulantes más recientes con datos de contacto
   * 
   * @example
   * GET /api/admin/applicants-stats/uuid-call-123/list
   */
  @Get(':callId/list')
  async getApplicantsList(@Param('callId') callId: string) {
    return this.stats.getApplicantsList(callId, 10);
  }
}
