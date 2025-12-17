import { Controller, Post, Body, Logger } from '@nestjs/common';
import { SupportMessagesService } from './support-messages.service';

/**
 * Controlador público para mensajes de contacto.
 * NO requiere autenticación - para personas que necesitan ayuda antes de iniciar sesión.
 */
@Controller('support-messages')
export class PublicContactController {
  private readonly logger = new Logger(PublicContactController.name);

  constructor(private readonly supportMessagesService: SupportMessagesService) {}

  /**
   * Endpoint público para contacto desde login (sin autenticación).
   * Ruta: POST /api/support-messages/contact
   */
  @Post('contact')
  async createContact(@Body() body: { fullName: string; email: string; subject: string; message: string }) {
    this.logger.log(
      `📧 Mensaje de contacto público de ${body.fullName} (${body.email}) - ` +
      `Asunto: "${body.subject}"`
    );
    
    return this.supportMessagesService.createPublicContact(body);
  }
}
