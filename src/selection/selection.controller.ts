import { Controller, Get, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DataSource } from 'typeorm';

@Controller('selection')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SelectionController {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Obtiene todos los postulantes de una convocatoria con su estado de hitos
   * Para la vista de Selección Final
   */
  @Get('call/:callId/applicants')
  @Roles('ADMIN', 'REVIEWER')
  async getApplicantsForSelection(@Param('callId') callId: string) {
    const query = `
      SELECT 
        app.id as "applicationId",
        app.status as "applicationStatus",
        app.submitted_at as "submittedAt",
        app.total_score as "totalScore",
        appl.id as "applicantId",
        appl.first_name || ' ' || appl.last_name as "applicantName",
        appl.email,
        appl.rut_number as "rutNumber",
        appl.rut_dv as "rutDv",
        
        -- Contar hitos
        COUNT(DISTINCT m.id) as "totalMilestones",
        COUNT(DISTINCT CASE WHEN mp.status = 'COMPLETED' THEN mp.id END) as "completedMilestones",
        COUNT(DISTINCT CASE WHEN mp.review_status = 'APPROVED' THEN mp.id END) as "approvedMilestones",
        COUNT(DISTINCT CASE WHEN mp.review_status = 'REJECTED' THEN mp.id END) as "rejectedMilestones",
        
        -- Estado resumido
        CASE 
          WHEN app.status = 'SELECTED' THEN 'SELECTED'
          WHEN app.status = 'NOT_SELECTED' THEN 'NOT_SELECTED'
          WHEN COUNT(DISTINCT CASE WHEN mp.review_status = 'REJECTED' THEN mp.id END) > 0 THEN 'HAS_REJECTED'
          WHEN COUNT(DISTINCT CASE WHEN mp.status = 'COMPLETED' THEN mp.id END) = COUNT(DISTINCT m.id) AND COUNT(DISTINCT m.id) > 0 THEN 'ALL_COMPLETED'
          ELSE 'IN_PROGRESS'
        END as "selectionStatus"
        
      FROM applications app
      INNER JOIN applicants appl ON appl.id = app.applicant_id
      LEFT JOIN milestones m ON m.call_id = app.call_id
      LEFT JOIN milestone_progress mp ON mp.application_id = app.id AND mp.milestone_id = m.id
      WHERE app.call_id = $1
        AND app.status != 'DRAFT'
      GROUP BY app.id, appl.id
      ORDER BY 
        CASE 
          WHEN app.status = 'SELECTED' THEN 1
          WHEN app.status = 'NOT_SELECTED' THEN 2
          ELSE 3
        END,
        app.total_score DESC NULLS LAST,
        appl.first_name, appl.last_name
    `;

    const results = await this.dataSource.query(query, [callId]);
    return results;
  }

  /**
   * Cambia el estado final de una postulación
   */
  @Patch('application/:applicationId/final-decision')
  @Roles('ADMIN')
  async setFinalDecision(
    @Param('applicationId') applicationId: string,
    @Body() body: { status?: 'SELECTED' | 'NOT_SELECTED'; decision?: 'SELECTED' | 'NOT_SELECTED'; reason?: string; notes?: string },
    @Req() req: any
  ) {
    const status = body.decision || body.status; // Soportar ambos nombres
    const { reason, notes } = body;
    const userId = req.user?.id;
    
    if (!status) {
      throw new Error('Se requiere decision o status');
    }

    // Actualizar status de la application
    await this.dataSource.query(
      `UPDATE applications SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, applicationId]
    );

    // Registrar en el historial
    await this.dataSource.query(
      `INSERT INTO application_status_history (application_id, from_status, to_status, actor_user_id, reason, created_at)
       SELECT id, status, $1, $2, $3, NOW()
       FROM applications
       WHERE id = $4`,
      [status, userId, reason || `Decisión final: ${status}`, applicationId]
    );

    // Registrar nota si existe
    if (notes) {
      await this.dataSource.query(
        `INSERT INTO application_notes (application_id, author_user_id, visibility, body, created_at)
         VALUES ($1, $2, 'INTERNAL', $3, NOW())`,
        [applicationId, userId, notes]
      );
    }

    return { success: true, status };
  }

  /**
   * Obtiene detalles de un postulante para la vista de selección
   */
  @Get('application/:applicationId/details')
  @Roles('ADMIN', 'REVIEWER')
  async getApplicationDetails(@Param('applicationId') applicationId: string) {
    // Información básica
    const appData = await this.dataSource.query(
      `SELECT 
        app.*,
        appl.first_name || ' ' || appl.last_name as "applicantName",
        appl.email,
        appl.phone,
        appl.rut_number as "rutNumber",
        appl.rut_dv as "rutDv"
       FROM applications app
       INNER JOIN applicants appl ON appl.id = app.applicant_id
       WHERE app.id = $1`,
      [applicationId]
    );

    // Estado de hitos
    const milestonesData = await this.dataSource.query(
      `SELECT 
        m.id as "milestoneId",
        m.name as "milestoneName",
        m.order_index as "orderIndex",
        mp.status,
        mp.review_status as "reviewStatus",
        mp.review_notes as "reviewNotes",
        mp.completed_at as "completedAt",
        u.first_name || ' ' || u.last_name as "reviewerName"
       FROM milestones m
       LEFT JOIN milestone_progress mp ON mp.milestone_id = m.id AND mp.application_id = $1
       LEFT JOIN users u ON u.id = mp.reviewed_by
       WHERE m.call_id = (SELECT call_id FROM applications WHERE id = $1)
       ORDER BY m.order_index`,
      [applicationId]
    );

    return {
      application: appData[0],
      milestones: milestonesData
    };
  }
}
