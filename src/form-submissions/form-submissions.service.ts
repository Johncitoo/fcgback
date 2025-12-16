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
    answers?: Record<string, any>;
    responses?: Record<string, any>;
  }): Promise<FormSubmission> {
    try {
      // Normalizar: 'responses' es un alias de 'answers' (compatibilidad)
      const normalizedData = { ...data };
      if (normalizedData.responses && !normalizedData.answers) {
        normalizedData.answers = normalizedData.responses;
        delete normalizedData.responses;
      }
      
      this.logger.log(`Creating submission for app ${data.applicationId}, milestone ${data.milestoneId}`);
      
      const submission = this.submissionsRepo.create(normalizedData);
      const saved = await this.submissionsRepo.save(submission);
      
      this.logger.log(`✅ Submission created: ${saved.id}`);
      return saved;
    } catch (error) {
      this.logger.error(`Error creating submission: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findByApplication(applicationId: string): Promise<FormSubmission[]> {
    return this.submissionsRepo.find({
      where: { applicationId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByMilestone(milestoneId: string): Promise<FormSubmission[]> {
    return this.submissionsRepo.find({
      where: { milestoneId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<FormSubmission> {
    const submission = await this.submissionsRepo.findOne({
      where: { id },
    });
    if (!submission) {
      throw new NotFoundException(`Submission ${id} not found`);
    }
    return submission;
  }

  async update(id: string, data: Partial<FormSubmission> & { answers?: any; responses?: any }): Promise<FormSubmission> {
    try {
      // Normalizar: 'responses' es un alias de 'answers' (compatibilidad)
      const normalizedData: any = { ...data };
      if (normalizedData.responses && !normalizedData.answers) {
        normalizedData.answers = normalizedData.responses;
        delete normalizedData.responses;
      }
      
      // Verificar que la submission existe antes de actualizar
      const existing = await this.submissionsRepo.findOne({ where: { id } });
      if (!existing) {
        throw new NotFoundException(`Submission ${id} not found`);
      }
      
      this.logger.log(`Updating submission ${id} with data keys: ${Object.keys(normalizedData).join(', ')}`);
      
      await this.submissionsRepo.update(id, normalizedData);
      return this.findOne(id);
    } catch (error) {
      this.logger.error(`Error updating submission ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async submit(id: string, userId: string): Promise<FormSubmission> {
    const submission = await this.findOne(id);
    
    await this.submissionsRepo.update(id, {
      submittedAt: new Date(),
    });

    // Update milestone progress AND unlock next milestone
    if (submission.milestoneId) {
      // Marcar como completado
      await this.progressRepo.update(
        { 
          applicationId: submission.applicationId,
          milestoneId: submission.milestoneId 
        },
        {
          status: 'COMPLETED',
          completedAt: new Date(),
        }
      );

      // Desbloquear el siguiente hito
      await this.dataSource.query(
        `UPDATE milestone_progress mp
         SET status = 'IN_PROGRESS'
         FROM milestones m1, milestones m2
         WHERE mp.milestone_id = m1.id
         AND m2.id = $1
         AND m1.call_id = m2.call_id
         AND m1.order_index = m2.order_index + 1
         AND mp.application_id = $2
         AND mp.status = 'PENDING'`,
        [submission.milestoneId, submission.applicationId]
      );
    }

    // Enviar email de confirmación de formulario enviado
    this.sendFormSubmittedConfirmation(userId, submission.applicationId, submission.milestoneId).catch(err => {
      this.logger.error(`Error enviando email de confirmación: ${err.message}`, err.stack);
    });

    return this.findOne(id);
  }

  /**
   * Envía email de confirmación cuando se envía un formulario
   */
  private async sendFormSubmittedConfirmation(userId: string, applicationId: string, milestoneId?: string): Promise<void> {
    try {
      // Obtener información del usuario, aplicación y convocatoria
      const result = await this.dataSource.query(
        `SELECT 
          u.email,
          u.full_name,
          c.name as call_name,
          m.name as milestone_name,
          f.name as form_name
        FROM users u
        JOIN applications a ON a.applicant_id = (SELECT applicant_id FROM users WHERE id = u.id)
        JOIN calls c ON c.id = a.call_id
        LEFT JOIN milestones m ON m.id = $3
        LEFT JOIN forms f ON f.id = m.form_id
        WHERE u.id = $1 AND a.id = $2
        LIMIT 1`,
        [userId, applicationId, milestoneId]
      );

      if (!result || result.length === 0) {
        this.logger.warn(`No se encontró información para enviar email de confirmación: user=${userId}, app=${applicationId}`);
        return;
      }

      const data = result[0];

      await this.emailService.sendFormSubmittedEmail(
        data.email,
        data.full_name || 'Postulante',
        data.call_name || 'Convocatoria',
        data.form_name || data.milestone_name || 'Formulario',
      );

      this.logger.log(`✅ Email de confirmación enviado a ${data.email}`);
    } catch (error) {
      this.logger.error(`Error en sendFormSubmittedConfirmation: ${error.message}`, error.stack);
      throw error;
    }
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
    // Simply delete the record
    await this.submissionsRepo.delete(id);
  }
}
