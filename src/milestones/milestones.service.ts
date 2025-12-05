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
  }): Promise<Milestone> {
    const milestone = this.milestonesRepo.create(data);
    return this.milestonesRepo.save(milestone);
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
    await this.milestonesRepo.update(id, data);
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
    
    for (const milestone of milestones) {
      const exists = await this.progressRepo.findOne({
        where: { applicationId, milestoneId: milestone.id },
      });

      if (!exists) {
        await this.progressRepo.save({
          applicationId,
          milestoneId: milestone.id,
          status: 'PENDING',
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

    // Si se aprueba, marcar como completado
    if (reviewStatus === 'APPROVED') {
      progress.status = 'COMPLETED';
      if (!progress.completedAt) {
        progress.completedAt = new Date();
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
}
