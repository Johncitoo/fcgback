import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { FormSubmission } from './entities/form-submission.entity';
import { MilestoneProgress } from '../milestone-progress/entities/milestone-progress.entity';
import { EmailService } from '../email/email.service';
import { randomBytes } from 'crypto';

@Injectable()
export class FormSubmissionsService {
  private readonly logger = new Logger(FormSubmissionsService.name);

  constructor(
    @InjectRepository(FormSubmission)
    private submissionsRepo: Repository<FormSubmission>,
    @InjectRepository(MilestoneProgress)
    private progressRepo: Repository<MilestoneProgress>,
    private readonly dataSource: DataSource,
    private readonly emailService: EmailService,
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

    // Enviar email para cambiar contraseña al completar formulario
    this.sendPasswordSetEmailAfterSubmit(userId, submission.applicationId).catch(err => {
      this.logger.error(`Error enviando email post-submit: ${err.message}`, err.stack);
    });

    return this.findOne(id);
  }

  /**
   * Envía email con token para cambiar contraseña cuando el postulante completa el formulario.
   * Esto permite al usuario acceder posteriormente para revisar su progreso.
   */
  private async sendPasswordSetEmailAfterSubmit(userId: string, applicationId: string): Promise<void> {
    try {
      // Obtener usuario y applicant info
      const userResult = await this.dataSource.query(`
        SELECT u.id, u.email, u.full_name, u.applicant_id, u.password_hash
        FROM users u
        WHERE u.id = $1
      `, [userId]);

      if (!userResult || userResult.length === 0) {
        this.logger.warn(`Usuario ${userId} no encontrado para enviar email post-submit`);
        return;
      }

      const user = userResult[0];

      // Solo enviar si el usuario aún tiene la contraseña temporal generada automáticamente
      // (no ha establecido su propia contraseña aún)
      const hasSetPassword = await this.dataSource.query(`
        SELECT EXISTS(
          SELECT 1 FROM password_reset_tokens 
          WHERE user_id = $1 AND used_at IS NOT NULL
        ) as has_used_token
      `, [userId]);

      if (hasSetPassword[0]?.has_used_token) {
        this.logger.log(`Usuario ${user.email} ya estableció contraseña, no se envía email`);
        return;
      }

      // Generar nuevo token para establecer contraseña
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48); // 48 horas para cambiar contraseña

      await this.dataSource.query(`
        INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at)
        VALUES ($1, $2, $3, NOW())
      `, [userId, token, expiresAt]);

      // Enviar email
      await this.emailService.sendPasswordSetEmail(
        user.email, 
        token, 
        user.full_name || 'Postulante'
      );

      this.logger.log(`Email para cambiar contraseña enviado a ${user.email} tras completar formulario`);
    } catch (error) {
      this.logger.error(`Error en sendPasswordSetEmailAfterSubmit: ${error.message}`, error.stack);
      throw error;
    }
  }

  async softDelete(id: string): Promise<void> {
    await this.submissionsRepo.update(id, { deletedAt: new Date() });
  }
}
