import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Milestone } from './entities/milestone.entity';
import { MilestoneProgress } from '../milestone-progress/entities/milestone-progress.entity';
import { EmailService } from '../email/email.service';

@Injectable()
export class MilestonesService {
  private readonly logger = new Logger(MilestonesService.name);

  constructor(
    @InjectRepository(Milestone)
    private milestonesRepo: Repository<Milestone>,
    @InjectRepository(MilestoneProgress)
    private progressRepo: Repository<MilestoneProgress>,
    @InjectDataSource()
    private ds: DataSource,
    private emailService: EmailService,
  ) {}

  /**
   * Crea un nuevo hito para una convocatoria.
   * Auto-inicializa milestone_progress para todas las aplicaciones existentes.
   * 
   * @param data - Datos del hito (callId, name, orderIndex requeridos)
   * @returns Hito creado
   * 
   * @example
   * const milestone = await create({ callId: 'uuid', name: 'Postulación', orderIndex: 1, whoCanFill: ['APPLICANT'] });
   */
  async create(data: {
    callId: string;
    formId?: string;
    name: string;
    description?: string;
    orderIndex: number;
    required?: boolean;
    whoCanFill?: string[];
    startDate?: Date;
    dueDate?: Date;
    status?: string;
  }): Promise<Milestone> {
    // Convertir whoCanFill a array si no lo es (mismo patrón que update)
    const whoCanFillArray = Array.isArray(data.whoCanFill) ? data.whoCanFill : [data.whoCanFill || 'APPLICANT'];
    
    // Usar SQL directo con parámetros (mismo patrón que update - probado y seguro)
    const result = await this.ds.query(
      `INSERT INTO milestones (call_id, form_id, name, description, order_index, required, who_can_fill, start_date, due_date, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       RETURNING *`,
      [
        data.callId,
        data.formId || null,
        data.name,
        data.description || null,
        data.orderIndex,
        data.required !== undefined ? data.required : true,
        whoCanFillArray,  // PostgreSQL maneja el array automáticamente con $7
        data.startDate || null,
        data.dueDate || null,
        data.status || 'ACTIVE'
      ]
    );
    
    const savedMilestone = result[0];

    // 🔥 AUTO-INICIALIZAR: Crear milestone_progress para todas las postulaciones existentes de esta convocatoria
    try {
      await this.ds.query(
        `INSERT INTO milestone_progress (application_id, milestone_id, status, created_at, updated_at)
         SELECT 
           a.id AS application_id,
           $1 AS milestone_id,
           'PENDING' AS status,
           NOW() AS created_at,
           NOW() AS updated_at
         FROM applications a
         WHERE a.call_id = $2
         ON CONFLICT DO NOTHING`,
        [savedMilestone.id, data.callId],
      );
    } catch (error) {
      console.error('Error auto-inicializando milestone_progress:', error);
      // No lanzamos error para no bloquear la creación del hito
    }

    return savedMilestone;
  }

  /**
   * Obtiene todos los hitos de una convocatoria ordenados por orderIndex.
   * 
   * @param callId - ID de la convocatoria
   * @returns Array de hitos ordenados
   * 
   * @example
   * const milestones = await findByCall('uuid-call');
   */
  async findByCall(callId: string): Promise<Milestone[]> {
    return this.milestonesRepo.find({
      where: { callId },
      order: { orderIndex: 'ASC' },
    });
  }

  /**
   * Obtiene un hito por su ID.
   * 
   * @param id - ID del hito
   * @returns Hito encontrado
   * @throws {NotFoundException} Si el hito no existe
   * 
   * @example
   * const milestone = await findOne('uuid-123');
   */
  async findOne(id: string): Promise<Milestone> {
    const milestone = await this.milestonesRepo.findOne({ where: { id } });
    if (!milestone) {
      throw new NotFoundException(`Milestone ${id} not found`);
    }
    return milestone;
  }

  /**
   * Actualiza parcialmente un hito.
   * Maneja whoCanFill con SQL directo debido a limitaciones de TypeORM con arrays.
   * 
   * @param id - ID del hito
   * @param data - Campos a actualizar
   * @returns Hito actualizado
   * 
   * @example
   * const milestone = await update('uuid-123', { name: 'Nuevo Nombre', required: false });
   */
  async update(id: string, data: Partial<Milestone>): Promise<Milestone> {
    // Separar whoCanFill del resto de datos porque TypeORM simple-array no funciona con query builder UPDATE
    const { whoCanFill, ...updateData } = data;
    
    // Actualizar otros campos con TypeORM
    await this.milestonesRepo.update(id, updateData);
    
    // Actualizar whoCanFill con SQL directo si fue proporcionado
    if (whoCanFill !== undefined) {
      const whoCanFillArray = Array.isArray(whoCanFill) ? whoCanFill : [whoCanFill];
      await this.ds.query(
        `UPDATE milestones SET who_can_fill = $1 WHERE id = $2`,
        [whoCanFillArray, id]
      );
    }
    
    return this.findOne(id);
  }

  /**
   * Elimina un hito por su ID.
   * 
   * @param id - ID del hito
   * 
   * @example
   * await remove('uuid-123');
   */
  async remove(id: string): Promise<void> {
    await this.milestonesRepo.delete(id);
  }

  /**
   * Obtiene el progreso de todos los hitos de una aplicación.
   * Incluye información del hito y estado de revisión.
   * 
   * @param applicationId - ID de la aplicación
   * @returns Array de milestone_progress con detalles del hito
   * 
   * @example
   * const progress = await getProgress('uuid-app');
   */
  async getProgress(applicationId: string): Promise<any> {
    // Obtener información de la application
    const application = await this.ds.query(
      `SELECT status, submitted_at FROM applications WHERE id = $1`,
      [applicationId]
    );

    const appStatus = application[0]?.status || 'DRAFT';
    const isRejected = appStatus === 'NOT_SELECTED';

    const progress = await this.progressRepo
      .createQueryBuilder('mp')
      .innerJoin('milestones', 'm', 'm.id = mp.milestone_id')
      .leftJoin('users', 'u', 'u.id = mp.reviewed_by')
      .select([
        'mp.id AS "mp_id"',
        'mp.milestone_id AS "milestoneId"',
        'mp.status AS "status"',
        'mp.completed_at AS "completedAt"',
        'mp.created_at AS "createdAt"',
        'mp.updated_at AS "updatedAt"',
        'mp.review_status AS "reviewStatus"',
        'mp.review_notes AS "reviewNotes"',
        'mp.reviewed_by AS "reviewedBy"',
        'mp.reviewed_at AS "reviewedAt"',
        'u.full_name AS "reviewerName"',
        'm.name AS "milestoneName"',
        'm.order_index AS "orderIndex"',
        'm.required',
        'm.who_can_fill AS "whoCanFill"',
        'm.status AS "milestoneStatus"',
        'm.form_id AS "formId"',
      ])
      .where('mp.application_id = :applicationId', { applicationId })
      .orderBy('m.order_index', 'ASC')
      .getRawMany();

    const total = progress.length;
    const completed = progress.filter((p) => p.status === 'COMPLETED').length;
    const blocked = progress.filter((p) => p.status === 'BLOCKED').length;
    const current = progress.find((p) => p.status === 'IN_PROGRESS');
    const rejectedMilestone = progress.find((p) => p.reviewStatus === 'REJECTED');

    return {
      progress,
      applicationStatus: appStatus,
      isRejected,
      rejectedMilestone: rejectedMilestone || null,
      summary: {
        total,
        completed,
        blocked,
        pending: total - completed - blocked,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        currentMilestone: current || null,
      },
    };
  }

  async initializeProgress(applicationId: string, callId: string): Promise<void> {
    const milestones = await this.findByCall(callId);
    
    // Ordenar por orderIndex para asegurar que el primero sea el de menor orden
    const sortedMilestones = milestones.sort((a, b) => a.orderIndex - b.orderIndex);
    
    for (let i = 0; i < sortedMilestones.length; i++) {
      const milestone = sortedMilestones[i];
      const exists = await this.progressRepo.findOne({
        where: { applicationId, milestoneId: milestone.id },
      });

      if (!exists) {
        // El primer hito (orderIndex más bajo) debe estar en IN_PROGRESS
        // Los demás en PENDING
        const status = i === 0 ? 'IN_PROGRESS' : 'PENDING';
        
        await this.progressRepo.save({
          applicationId,
          milestoneId: milestone.id,
          status,
        });
      }
    }
  }

  async reviewMilestone(
    progressId: string,
    reviewStatus: 'APPROVED' | 'REJECTED',
    reviewedBy: string,
    reviewNotes?: string,
  ): Promise<MilestoneProgress> {
    this.logger.log(
      `🔍 reviewMilestone() llamado - ProgressID: ${progressId}, ` +
      `ReviewStatus: ${reviewStatus}, ReviewedBy: ${reviewedBy}, ` +
      `Versión: v2.0-BLOQUEO-CASCADA`
    );
    
    const progress = await this.progressRepo.findOne({
      where: { id: progressId },
    });

    if (!progress) {
      throw new NotFoundException('Milestone progress not found');
    }

    // Actualizar el estado de revisión
    progress.reviewStatus = reviewStatus;
    progress.reviewNotes = reviewNotes || null;
    progress.reviewedBy = reviewedBy;
    progress.reviewedAt = new Date();

    // Si se aprueba, marcar como completado Y desbloquear el siguiente hito
    if (reviewStatus === 'APPROVED') {
      progress.status = 'COMPLETED';
      if (!progress.completedAt) {
        progress.completedAt = new Date();
      }

      // Obtener el milestone para saber el orderIndex
      const milestone = await this.milestonesRepo.findOne({
        where: { id: progress.milestoneId },
      });

      if (milestone) {
        // Activar el siguiente hito (orderIndex siguiente)
        await this.ds.query(
          `UPDATE milestone_progress mp
           SET status = 'IN_PROGRESS'
           FROM milestones m
           WHERE mp.milestone_id = m.id
           AND mp.application_id = $1
           AND m.call_id = $2
           AND m.order_index = $3
           AND mp.status = 'PENDING'`,
          [progress.applicationId, milestone.callId, milestone.orderIndex + 1],
        );
        
        // Enviar email de aprobación
        this.sendMilestoneApprovedEmail(progress.applicationId, milestone, milestone.orderIndex + 1).catch(err => {
          this.logger.error(`Error enviando email de aprobación: ${err.message}`);
        });
      }
    }

    // Si se rechaza, marcar como COMPLETED con review_status REJECTED
    // El constraint de BD solo permite: PENDING, IN_PROGRESS, COMPLETED, SKIPPED, BLOCKED
    if (reviewStatus === 'REJECTED') {
      progress.status = 'COMPLETED'; // Marcar como completado pero con review rechazado
      
      // Obtener el milestone para saber el orderIndex
      const milestone = await this.milestonesRepo.findOne({
        where: { id: progress.milestoneId },
      });

      if (milestone) {
        // BLOQUEAR LA POSTULACIÓN COMPLETA
        // 1. Cambiar estado de la application a NOT_SELECTED (rechazada)
        await this.ds.query(
          `UPDATE applications 
           SET status = 'NOT_SELECTED', updated_at = NOW()
           WHERE id = $1`,
          [progress.applicationId]
        );

        // 2. Bloquear todos los hitos siguientes (status = BLOCKED)
        const blockedCount = await this.ds.query(
          `UPDATE milestone_progress mp
           SET status = 'BLOCKED'
           FROM milestones m
           WHERE mp.milestone_id = m.id
           AND mp.application_id = $1
           AND m.call_id = $2
           AND m.order_index > $3
           AND mp.status IN ('PENDING', 'IN_PROGRESS')
           RETURNING mp.id`,
          [progress.applicationId, milestone.callId, milestone.orderIndex]
        );
        
        this.logger.log(
          `✅ Bloqueados ${blockedCount.length} hitos subsecuentes al hito "${milestone.name}" (orderIndex: ${milestone.orderIndex})`
        );

        // 3. Registrar en el historial de estados
        await this.ds.query(
          `INSERT INTO application_status_history 
           (application_id, from_status, to_status, actor_user_id, reason, created_at)
           SELECT $1, status, 'NOT_SELECTED', $2, $3, NOW()
           FROM applications WHERE id = $1`,
          [
            progress.applicationId, 
            reviewedBy, 
            `Rechazado en hito: ${milestone.name}. Notas: ${reviewNotes || 'Sin notas adicionales'}`
          ]
        );

        this.logger.warn(
          `❌ Postulación ${progress.applicationId} RECHAZADA en hito "${milestone.name}" (orderIndex: ${milestone.orderIndex}). ` +
          `Application status → NOT_SELECTED. Hitos bloqueados: ${blockedCount.length}`
        );
        
        // Enviar email de rechazo (ÚLTIMO EMAIL - proceso terminado)
        this.sendMilestoneRejectedEmail(progress.applicationId, milestone).catch(err => {
          this.logger.error(`Error enviando email de rechazo: ${err.message}`);
        });
      }
    }

    return this.progressRepo.save(progress);
  }

  async getMilestoneSubmission(milestoneProgressId: string) {
    const progress = await this.progressRepo.findOne({
      where: { id: milestoneProgressId },
    });

    if (!progress) {
      throw new NotFoundException('Milestone progress not found');
    }

    // Buscar la submission correspondiente
    const submission = await this.ds.query(
      `SELECT 
        fs.id,
        fs.form_data as "answers",
        fs.submitted_at as "submittedAt",
        fs.created_at as "createdAt",
        fs.updated_at as "updatedAt",
        f.name as "formName",
        f.schema as "formSchema",
        CASE 
          WHEN fs.submitted_at IS NOT NULL THEN 'SUBMITTED'
          ELSE 'DRAFT'
        END as "status"
      FROM form_submissions fs
      LEFT JOIN forms f ON f.id = fs.form_id
      WHERE fs.application_id = $1 
      AND fs.milestone_id = $2
      ORDER BY fs.created_at DESC
      LIMIT 1`,
      [progress.applicationId, progress.milestoneId],
    );

    return submission?.[0] || null;
  }

  /**
   * Sincroniza milestone_progress para todas las postulaciones de una convocatoria
   * Crea los registros faltantes para postulantes que se agregaron antes de crear un hito
   */
  async syncProgressForCall(callId: string): Promise<{ created: number }> {
    const result = await this.ds.query(
      `INSERT INTO milestone_progress (application_id, milestone_id, status, created_at, updated_at)
       SELECT 
         a.id AS application_id,
         m.id AS milestone_id,
         'PENDING' AS status,
         NOW() AS created_at,
         NOW() AS updated_at
       FROM applications a
       CROSS JOIN milestones m
       WHERE a.call_id = $1
       AND m.call_id = $1
       AND NOT EXISTS (
         SELECT 1 
         FROM milestone_progress mp 
         WHERE mp.application_id = a.id 
         AND mp.milestone_id = m.id
       )
       RETURNING *`,
      [callId],
    );

    return { created: result.length };
  }

  // ========================================
  // MÉTODOS PRIVADOS - ENVÍO DE EMAILS
  // ========================================

  /**
   * Envía email de hito aprobado
   */
  private async sendMilestoneApprovedEmail(
    applicationId: string,
    currentMilestone: Milestone,
    nextMilestoneOrder: number,
  ): Promise<void> {
    try {
      // Obtener información del postulante, convocatoria y siguiente hito
      const result = await this.ds.query(
        `SELECT 
          u.email,
          u.full_name,
          c.name as call_name,
          m_next.name as next_milestone_name
        FROM applications a
        JOIN users u ON u.applicant_id = a.applicant_id
        JOIN calls c ON c.id = a.call_id
        LEFT JOIN milestones m_next ON m_next.call_id = c.id AND m_next.order_index = $3
        WHERE a.id = $1
        LIMIT 1`,
        [applicationId, currentMilestone.id, nextMilestoneOrder]
      );

      if (!result || result.length === 0) return;

      const data = result[0];

      await this.emailService.sendMilestoneApprovedEmail(
        data.email,
        data.full_name || 'Postulante',
        data.call_name || 'Convocatoria',
        currentMilestone.name,
        data.next_milestone_name || undefined,
      );

      this.logger.log(`Email de aprobación enviado: ${currentMilestone.name} → ${data.email}`);
    } catch (error) {
      this.logger.error(`Error enviando email de aprobación: ${error.message}`);
    }
  }

  /**
   * Envía email de hito rechazado (ÚLTIMO EMAIL - lógica de negocio)
   */
  private async sendMilestoneRejectedEmail(
    applicationId: string,
    milestone: Milestone,
  ): Promise<void> {
    try {
      const result = await this.ds.query(
        `SELECT 
          u.email,
          u.full_name,
          c.name as call_name
        FROM applications a
        JOIN users u ON u.applicant_id = a.applicant_id
        JOIN calls c ON c.id = a.call_id
        WHERE a.id = $1
        LIMIT 1`,
        [applicationId]
      );

      if (!result || result.length === 0) return;

      const data = result[0];

      await this.emailService.sendMilestoneRejectedEmail(
        data.email,
        data.full_name || 'Postulante',
        data.call_name || 'Convocatoria',
        milestone.name,
      );

      this.logger.log(`Email de rechazo enviado (último): ${milestone.name} → ${data.email}`);
    } catch (error) {
      this.logger.error(`Error enviando email de rechazo: ${error.message}`);
    }
  }
}
