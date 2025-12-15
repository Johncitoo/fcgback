import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Milestone } from './entities/milestone.entity';
import { MilestoneProgress } from '../milestone-progress/entities/milestone-progress.entity';

@Injectable()
export class MilestonesService {
  constructor(
    @InjectRepository(Milestone)
    private milestonesRepo: Repository<Milestone>,
    @InjectRepository(MilestoneProgress)
    private progressRepo: Repository<MilestoneProgress>,
    @InjectDataSource()
    private ds: DataSource,
  ) {}

  async create(data: {
    callId: string;
    formId?: string;
    name: string;
    description?: string;
    orderIndex: number;
    required?: boolean;
    whoCanFill?: string[];
    dueDate?: Date;
    status?: string;
  }): Promise<Milestone> {
    // Convertir whoCanFill a array si no lo es (mismo patrón que update)
    const whoCanFillArray = Array.isArray(data.whoCanFill) ? data.whoCanFill : [data.whoCanFill || 'APPLICANT'];
    
    // Usar SQL directo con parámetros (mismo patrón que update - probado y seguro)
    const result = await this.ds.query(
      `INSERT INTO milestones (call_id, form_id, name, description, order_index, required, who_can_fill, due_date, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING *`,
      [
        data.callId,
        data.formId || null,
        data.name,
        data.description || null,
        data.orderIndex,
        data.required !== undefined ? data.required : true,
        whoCanFillArray,  // PostgreSQL maneja el array automáticamente con $7
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

  async findByCall(callId: string): Promise<Milestone[]> {
    return this.milestonesRepo.find({
      where: { callId },
      order: { orderIndex: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Milestone> {
    const milestone = await this.milestonesRepo.findOne({ where: { id } });
    if (!milestone) {
      throw new NotFoundException(`Milestone ${id} not found`);
    }
    return milestone;
  }

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

  async remove(id: string): Promise<void> {
    await this.milestonesRepo.delete(id);
  }

  async getProgress(applicationId: string): Promise<any> {
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
    const current = progress.find((p) => p.status === 'IN_PROGRESS');

    return {
      progress,
      summary: {
        total,
        completed,
        pending: total - completed,
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
    reviewStatus: 'APPROVED' | 'REJECTED' | 'NEEDS_CHANGES',
    reviewedBy: string,
    reviewNotes?: string,
  ): Promise<MilestoneProgress> {
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
      }
    }

    // Si se rechaza, cambiar el estado y bloquear hitos siguientes
    if (reviewStatus === 'REJECTED') {
      progress.status = 'REJECTED';
      
      // Obtener el milestone para saber el orderIndex
      const milestone = await this.milestonesRepo.findOne({
        where: { id: progress.milestoneId },
      });

      if (milestone) {
        // Bloquear todos los hitos siguientes (orderIndex mayor)
        await this.ds.query(
          `UPDATE milestone_progress mp
           SET status = 'REJECTED', review_status = 'REJECTED', review_notes = 'Bloqueado por rechazo de hito anterior'
           FROM milestones m
           WHERE mp.milestone_id = m.id
           AND mp.application_id = $1
           AND m.call_id = $2
           AND m.order_index > $3
           AND mp.status NOT IN ('COMPLETED', 'REJECTED')`,
          [progress.applicationId, milestone.callId, milestone.orderIndex],
        );
      }
    }

    // Si necesita cambios, cambiar el estado
    if (reviewStatus === 'NEEDS_CHANGES') {
      progress.status = 'NEEDS_CHANGES';
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
        fs.answers,
        fs.status,
        fs.submitted_at as "submittedAt",
        fs.created_at as "createdAt",
        fs.updated_at as "updatedAt",
        f.name as "formName",
        f.schema as "formSchema"
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
}
