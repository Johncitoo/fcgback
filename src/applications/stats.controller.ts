import { Controller, Get, Param } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { Roles } from '../auth/roles.decorator';

/**
 * Controller para estadísticas de aplicaciones por convocatoria.
 * 
 * Proporciona endpoints de análisis y reportes:
 * - Vista general (totales, aprobados, rechazados)
 * - Distribución por género
 * - Top instituciones educativas
 * - Top comunas
 * - Distribución de puntajes
 * - Timeline de envíos
 * 
 * Todas las estadísticas se filtran por convocatoria (callId).
 * 
 * @path /admin/stats
 * @roles ADMIN, REVIEWER - Solo staff puede acceder a estadísticas
 */
@Controller('admin/stats')
@Roles('ADMIN', 'REVIEWER')
export class StatsController {
  constructor(private apps: ApplicationsService) {}

  /**
   * Obtiene vista general de estadísticas de una convocatoria.
   * 
   * Retorna totales de aplicaciones, estados, promedios y métricas generales.
   * 
   * @param callId - ID de la convocatoria
   * @returns Objeto con estadísticas generales (total, aprobados, rechazados, en revisión, etc.)
   * 
   * @example
   * GET /api/admin/stats/uuid-call-123/overview
   */
  @Get(':callId/overview')
  async getOverview(@Param('callId') callId: string) {
    return this.apps.getStatsOverview(callId);
  }

  /**
   * Obtiene distribución de postulantes por género.
   * 
   * @param callId - ID de la convocatoria
   * @returns Array con conteos por género
   * 
   * @example
   * GET /api/admin/stats/uuid-call-123/gender-distribution
   */
  @Get(':callId/gender-distribution')
  async getGenderDistribution(@Param('callId') callId: string) {
    return this.apps.getGenderDistribution(callId);
  }

  /**
   * Obtiene las instituciones educativas con más postulantes.
   * 
   * @param callId - ID de la convocatoria
   * @returns Array de instituciones ordenado por cantidad de postulantes
   * 
   * @example
   * GET /api/admin/stats/uuid-call-123/top-institutions
   */
  @Get(':callId/top-institutions')
  async getTopInstitutions(@Param('callId') callId: string) {
    return this.apps.getTopInstitutions(callId);
  }

  /**
   * Obtiene las comunas con más postulantes.
   * 
   * @param callId - ID de la convocatoria
   * @returns Array de comunas ordenado por cantidad de postulantes
   * 
   * @example
   * GET /api/admin/stats/uuid-call-123/top-communes
   */
  @Get(':callId/top-communes')
  async getTopCommunes(@Param('callId') callId: string) {
    return this.apps.getTopCommunes(callId);
  }

  /**
   * Obtiene distribución de puntajes de aplicaciones.
   * 
   * @param callId - ID de la convocatoria
   * @returns Array con rangos de puntajes y cantidad de postulantes en cada rango
   * 
   * @example
   * GET /api/admin/stats/uuid-call-123/score-distribution
   */
  @Get(':callId/score-distribution')
  async getScoreDistribution(@Param('callId') callId: string) {
    return this.apps.getScoreDistribution(callId);
  }

  /**
   * Obtiene timeline de envíos de aplicaciones a lo largo del tiempo.
   * 
   * Útil para visualizar curvas de postulación y momentos peak de envíos.
   * 
   * @param callId - ID de la convocatoria
   * @returns Array con fechas y cantidad de envíos por período
   * 
   * @example
   * GET /api/admin/stats/uuid-call-123/submission-timeline
   */
  @Get(':callId/submission-timeline')
  async getSubmissionTimeline(@Param('callId') callId: string) {
    return this.apps.getSubmissionTimeline(callId);
  }
}
