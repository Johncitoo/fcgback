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
   * Guarda en BD y envía email a todos los administradores.
   */
  async create(dto: CreateSupportMessageDto): Promise<SupportMessage> {
    this.logger.log(`📨 Nuevo mensaje de soporte de ${dto.applicantEmail}: ${dto.subject}`);

    // Guardar mensaje en base de datos
    const result = await this.dataSource.query(
      `INSERT INTO support_messages 
       (application_id, applicant_email, subject, message, status, created_at)
       VALUES ($1, $2, $3, $4, 'OPEN', NOW())
       RETURNING *`,
      [dto.applicationId, dto.applicantEmail, dto.subject, dto.message]
    );

    const message = result[0];

    // Obtener todos los administradores activos
    const admins = await this.dataSource.query(
      `SELECT email, full_name FROM users WHERE role = 'ADMIN' AND is_active = true`
    );

    if (admins.length > 0) {
      this.logger.log(`📧 Enviando notificación a ${admins.length} administrador(es)`);

      // Enviar email a cada administrador
      const emailPromises = admins.map(admin => {
        const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">🆘 Nueva Solicitud de Ayuda</h2>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>De:</strong> ${dto.applicantEmail}</p>
              <p><strong>ID Postulación:</strong> ${dto.applicationId}</p>
              <p><strong>Asunto:</strong> ${dto.subject}</p>
            </div>
            <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <h3 style="margin-top: 0;">Mensaje:</h3>
              <p style="white-space: pre-wrap;">${dto.message}</p>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
              Este es un mensaje automático del sistema de postulaciones.<br>
              Por favor, contacta directamente al postulante para ayudarle.
            </p>
          </div>
        `;

        return this.emailService.sendEmail(
          {
            to: admin.email,
            subject: `🆘 Solicitud de ayuda: ${dto.subject}`,
            htmlContent,
          },
          EmailCategory.TRANSACTIONAL
        ).catch(error => {
          this.logger.error(`❌ Error enviando email a ${admin.email}: ${error.message}`);
          return false;
        });
      });

      await Promise.all(emailPromises);
      this.logger.log(`✅ Notificaciones enviadas a administradores`);
    } else {
      this.logger.warn(`⚠️ No hay administradores activos para notificar`);
    }

    return this.mapToSupportMessage(message);
  }

  /**
   * Crea un mensaje de contacto público (sin applicationId).
   * Para personas que necesitan ayuda antes de iniciar sesión.
   */
  async createPublicContact(data: { fullName: string; email: string; subject: string; message: string }): Promise<any> {
    this.logger.log(`📧 Mensaje de contacto público de ${data.fullName} (${data.email}): ${data.subject}`);

    // Obtener todos los administradores activos
    const admins = await this.dataSource.query(
      `SELECT email, full_name FROM users WHERE role = 'ADMIN' AND is_active = true`
    );

    if (admins.length > 0) {
      this.logger.log(`📧 Enviando notificación a ${admins.length} administrador(es)`);

      // Enviar email a cada administrador
      const emailPromises = admins.map(admin => {
        const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">📧 Nuevo Mensaje de Contacto</h2>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>De:</strong> ${data.fullName}</p>
              <p><strong>Email:</strong> ${data.email}</p>
              <p><strong>Asunto:</strong> ${data.subject}</p>
            </div>
            <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <h3 style="margin-top: 0;">Mensaje:</h3>
              <p style="white-space: pre-wrap;">${data.message}</p>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
              Este mensaje fue enviado desde la página de inicio de sesión.<br>
              La persona aún no ha iniciado sesión en el sistema.
            </p>
          </div>
        `;

        return this.emailService.sendEmail(
          {
            to: admin.email,
            subject: `📧 Contacto: ${data.subject}`,
            htmlContent,
          },
          EmailCategory.TRANSACTIONAL
        ).catch(error => {
          this.logger.error(`❌ Error enviando email a ${admin.email}: ${error.message}`);
          return false;
        });
      });

      await Promise.all(emailPromises);
      this.logger.log(`✅ Notificaciones enviadas a administradores`);
    } else {
      this.logger.warn(`⚠️ No hay administradores activos para notificar`);
    }

    return {
      success: true,
      message: 'Tu mensaje ha sido enviado. Los administradores te contactarán pronto.',
    };
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
