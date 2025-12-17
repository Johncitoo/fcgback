import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Service para estadísticas de postulantes (applicants).
 * 
 * Proporciona métricas basadas en datos REALES de la entidad applicants:
 * - Distribución por comuna y región
 * - Distribución por rango de edad
 * - Conteo de campos completados (email, teléfono, dirección)
 * - Estadísticas de contacto
 */
@Injectable()
export class ApplicantsStatsService {
  constructor(private ds: DataSource) {}

  /**
   * Obtiene las 10 comunas con más postulantes en una convocatoria.
   * 
   * @param callId - ID de la convocatoria
   * @returns Array de comunas ordenadas por cantidad
   */
  async getTopCommunesByCall(callId: string) {
    const result = await this.ds.query(
      `SELECT 
        COALESCE(NULLIF(TRIM(ap.commune), ''), 'Sin comuna') as commune,
        COUNT(DISTINCT ap.id) as count
       FROM applicants ap
       INNER JOIN applications a ON a.applicant_id = ap.id
       WHERE a.call_id = $1
       GROUP BY ap.commune
       ORDER BY count DESC
       LIMIT 10`,
      [callId],
    );
    return result;
  }

  /**
   * Obtiene las regiones con más postulantes en una convocatoria.
   * 
   * @param callId - ID de la convocatoria
   * @returns Array de regiones ordenadas por cantidad
   */
  async getTopRegionsByCall(callId: string) {
    const result = await this.ds.query(
      `SELECT 
        COALESCE(NULLIF(TRIM(ap.region), ''), 'Sin región') as region,
        COUNT(DISTINCT ap.id) as count
       FROM applicants ap
       INNER JOIN applications a ON a.applicant_id = ap.id
       WHERE a.call_id = $1
       GROUP BY ap.region
       ORDER BY count DESC
       LIMIT 10`,
      [callId],
    );
    return result;
  }

  /**
   * Obtiene la distribución por rango de edad de postulantes.
   * 
   * @param callId - ID de la convocatoria
   * @returns Array con conteo por rango etario
   */
  async getAgeDistributionByCall(callId: string) {
    const result = await this.ds.query(
      `SELECT 
        CASE 
          WHEN ap.birth_date IS NULL THEN 'Sin fecha'
          WHEN DATE_PART('year', AGE(ap.birth_date)) < 18 THEN 'Menor de 18'
          WHEN DATE_PART('year', AGE(ap.birth_date)) BETWEEN 18 AND 25 THEN '18-25 años'
          WHEN DATE_PART('year', AGE(ap.birth_date)) BETWEEN 26 AND 35 THEN '26-35 años'
          WHEN DATE_PART('year', AGE(ap.birth_date)) BETWEEN 36 AND 50 THEN '36-50 años'
          ELSE 'Mayor de 50'
        END as age_range,
        COUNT(DISTINCT ap.id) as count
       FROM applicants ap
       INNER JOIN applications a ON a.applicant_id = ap.id
       WHERE a.call_id = $1
       GROUP BY age_range
       ORDER BY 
         CASE age_range
           WHEN 'Sin fecha' THEN 6
           WHEN 'Menor de 18' THEN 1
           WHEN '18-25 años' THEN 2
           WHEN '26-35 años' THEN 3
           WHEN '36-50 años' THEN 4
           WHEN 'Mayor de 50' THEN 5
         END`,
      [callId],
    );
    return result;
  }

  /**
   * Obtiene estadísticas de completitud de datos de contacto.
   * 
   * @param callId - ID de la convocatoria
   * @returns Objeto con conteos de campos completados
   */
  async getContactCompleteness(callId: string) {
    const result = await this.ds.query(
      `SELECT 
        COUNT(DISTINCT ap.id) as total_applicants,
        COUNT(DISTINCT CASE WHEN ap.email IS NOT NULL AND TRIM(ap.email) != '' THEN ap.id END) as with_email,
        COUNT(DISTINCT CASE WHEN ap.phone IS NOT NULL AND TRIM(ap.phone) != '' THEN ap.id END) as with_phone,
        COUNT(DISTINCT CASE WHEN ap.address IS NOT NULL AND TRIM(ap.address) != '' THEN ap.id END) as with_address,
        COUNT(DISTINCT CASE WHEN ap.commune IS NOT NULL AND TRIM(ap.commune) != '' THEN ap.id END) as with_commune,
        COUNT(DISTINCT CASE WHEN ap.region IS NOT NULL AND TRIM(ap.region) != '' THEN ap.id END) as with_region,
        COUNT(DISTINCT CASE WHEN ap.birth_date IS NOT NULL THEN ap.id END) as with_birth_date
       FROM applicants ap
       INNER JOIN applications a ON a.applicant_id = ap.id
       WHERE a.call_id = $1`,
      [callId],
    );
    
    const row = result[0] || {};
    return {
      total_applicants: parseInt(row.total_applicants) || 0,
      with_email: parseInt(row.with_email) || 0,
      with_phone: parseInt(row.with_phone) || 0,
      with_address: parseInt(row.with_address) || 0,
      with_commune: parseInt(row.with_commune) || 0,
      with_region: parseInt(row.with_region) || 0,
      with_birth_date: parseInt(row.with_birth_date) || 0,
    };
  }

  /**
   * Obtiene lista de postulantes con datos básicos para una convocatoria.
   * 
   * @param callId - ID de la convocatoria
   * @param limit - Número máximo de resultados
   * @returns Array de postulantes con datos de contacto
   */
  async getApplicantsList(callId: string, limit: number = 10) {
    const result = await this.ds.query(
      `SELECT 
        ap.id,
        ap.rut_number,
        ap.rut_dv,
        ap.first_name,
        ap.last_name,
        ap.full_name,
        ap.email,
        ap.phone,
        ap.commune,
        ap.region,
        ap.birth_date,
        ap.created_at,
        a.status as application_status,
        a.submitted_at
       FROM applicants ap
       INNER JOIN applications a ON a.applicant_id = ap.id
       WHERE a.call_id = $1
       ORDER BY a.created_at DESC
       LIMIT $2`,
      [callId, limit],
    );
    return result;
  }
}
