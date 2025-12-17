import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';import { EmailService, EmailCategory } from '../email/email.service';
import { UsersService } from '../users/users.service';
export interface CreateSupportMessageDto {
  applicationId: string;
  applicantEmail: string;
  subject: string;
  message: string;
}

export interface SupportMessage {
  id: string;
  applicationId: string;
  applicantEmail: string;
  subject: string;
  message: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  adminNotes?: string;
}

/**
 * Servicio para gestionar mensajes de soporte/ayuda de postulantes.
 * Los postulantes pueden enviar consultas que los admins ven y responden.
 */
@Injectable()
export class SupportMessagesService {
  private readonly logger = new Logger(SupportMessagesService.name);

  constructor(
    private dataSource: DataSource,
    private emailService: EmailService,
    private usersService: UsersService,
  ) {}

  /**
   * Crea un nuevo mensaje de soporte desde un postulante.
   */
  async create(dto: CreateSupportMessageDto): Promise<SupportMessage> {
    const result = await this.dataSource.query(
      `INSERT INTO support_messages 
       (application_id, applicant_email, subject, message, status, created_at)
       VALUES ($1, $2, $3, $4, 'OPEN', NOW())
       RETURNING *`,
      [dto.applicationId, dto.applicantEmail, dto.subject, dto.message]
    );

    this.logger.log(
      `📨 Nuevo mensaje de soporte de ${dto.applicantEmail} - ` +
      `Asunto: "${dto.subject}" (App: ${dto.applicationId})`
    );

    return this.mapToSupportMessage(result[0]);
  }

  /**
   * Obtiene todos los mensajes de soporte (para admins).
   * Puede filtrar por status.
   */
  async findAll(status?: string): Promise<SupportMessage[]> {
    const query = status
      ? `SELECT * FROM support_messages WHERE status = $1 ORDER BY created_at DESC`
      : `SELECT * FROM support_messages ORDER BY created_at DESC`;
    
    const params = status ? [status] : [];
    const result = await this.dataSource.query(query, params);
    
    return result.map(this.mapToSupportMessage);
  }

  /**
   * Obtiene mensajes de soporte de una aplicación específica.
   */
  async findByApplication(applicationId: string): Promise<SupportMessage[]> {
    const result = await this.dataSource.query(
      `SELECT * FROM support_messages 
       WHERE application_id = $1 
       ORDER BY created_at DESC`,
      [applicationId]
    );
    
    return result.map(this.mapToSupportMessage);
  }

  /**
   * Actualiza el estado de un mensaje y agrega notas del admin.
   */
  async updateStatus(
    id: string,
    status: 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
    adminUserId: string,
    adminNotes?: string
  ): Promise<SupportMessage> {
    const resolvedAt = status === 'RESOLVED' || status === 'CLOSED' ? new Date() : null;
    
    const result = await this.dataSource.query(
      `UPDATE support_messages 
       SET status = $1, resolved_by = $2, admin_notes = $3, resolved_at = $4
       WHERE id = $5
       RETURNING *`,
      [status, adminUserId, adminNotes, resolvedAt, id]
    );

    this.logger.log(
      `✅ Mensaje de soporte ${id} actualizado a ${status} por admin ${adminUserId}`
    );

    return this.mapToSupportMessage(result[0]);
  }

  private mapToSupportMessage(row: any): SupportMessage {
    return {
      id: row.id,
      applicationId: row.application_id,
      applicantEmail: row.applicant_email,
      subject: row.subject,
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
      resolvedBy: row.resolved_by,
      adminNotes: row.admin_notes,
    };
  }
}
