import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Milestone } from './entities/milestone.entity';
import { MilestoneProgress } from '../milestone-progress/entities/milestone-progress.entity';

@Injectable()
export class MilestonesService {
  constructor(
    @InjectRepository(Milestone)
    private milestonesRepo: Repository<Milestone>,
    @InjectRepository(MilestoneProgress)
    private progressRepo: Repository<MilestoneProgress>,
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
      .select([
        'mp.id',
        'mp.milestone_id as "milestoneId"',
        'mp.status',
        'mp.started_at as "startedAt"',
        'mp.completed_at as "completedAt"',
        'm.name as "milestoneName"',
        'm.order_index as "orderIndex"',
        'm.required',
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
}
