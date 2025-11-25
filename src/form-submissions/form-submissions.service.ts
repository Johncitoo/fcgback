import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FormSubmission } from './entities/form-submission.entity';
import { MilestoneProgress } from '../milestone-progress/entities/milestone-progress.entity';

@Injectable()
export class FormSubmissionsService {
  constructor(
    @InjectRepository(FormSubmission)
    private submissionsRepo: Repository<FormSubmission>,
    @InjectRepository(MilestoneProgress)
    private progressRepo: Repository<MilestoneProgress>,
  ) {}

  async create(data: {
    applicationId: string;
    formId?: string;
    milestoneId?: string;
    formData: Record<string, any>;
    submittedBy?: string;
  }): Promise<FormSubmission> {
    const submission = this.submissionsRepo.create(data);
    return this.submissionsRepo.save(submission);
  }

  async findByApplication(applicationId: string): Promise<FormSubmission[]> {
    return this.submissionsRepo.find({
      where: { applicationId, deletedAt: null as any },
      order: { createdAt: 'DESC' },
    });
  }

  async findByMilestone(milestoneId: string): Promise<FormSubmission[]> {
    return this.submissionsRepo.find({
      where: { milestoneId, deletedAt: null as any },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<FormSubmission> {
    const submission = await this.submissionsRepo.findOne({
      where: { id, deletedAt: null as any },
    });
    if (!submission) {
      throw new NotFoundException(`Submission ${id} not found`);
    }
    return submission;
  }

  async update(id: string, data: Partial<FormSubmission>): Promise<FormSubmission> {
    await this.submissionsRepo.update(id, data);
    return this.findOne(id);
  }

  async submit(id: string, userId: string): Promise<FormSubmission> {
    const submission = await this.findOne(id);
    
    await this.submissionsRepo.update(id, {
      status: 'SUBMITTED',
      submittedAt: new Date(),
      submittedBy: userId,
    });

    // Update milestone progress
    if (submission.milestoneId) {
      await this.progressRepo.update(
        { 
          applicationId: submission.applicationId,
          milestoneId: submission.milestoneId 
        },
        {
          status: 'COMPLETED',
          completedAt: new Date(),
          completedBy: userId,
          formSubmissionId: id,
        }
      );
    }

    return this.findOne(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.submissionsRepo.update(id, { deletedAt: new Date() });
  }
}
