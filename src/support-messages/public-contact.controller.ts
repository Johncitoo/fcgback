import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { SupportMessagesService } from './support-messages.service';

/**
 * Controlador público para mensajes de contacto.
 * NO requiere autenticación - para personas que necesitan ayuda antes de iniciar sesión.
 * 
 * IMPORTANTE: Este controller NO debe tener @UseGuards(JwtAuthGuard) ni ningún otro guard
 * de autenticación, ya que es para usuarios sin login.
 * 
 * Usa ruta separada 'public-contact' para evitar conflictos con support-messages protegido.
 */
@ApiTags('Public Contact')
@Controller('public-contact')
@Public()
export class PublicContactController {
  private readonly logger = new Logger(PublicContactController.name);

  constructor(private readonly supportMessagesService: SupportMessagesService) {}

  /**
   * Endpoint público para contacto desde login (sin autenticación).
   * Ruta: POST /api/public-contact
   * 
   * Rate limiting: 3 mensajes por IP cada 10 minutos para evitar spam.
   */
  @Post()
  @Throttle({ default: { limit: 3, ttl: 600000 } }) // 3 requests cada 10 minutos por IP
  @ApiOperation({ summary: 'Enviar mensaje público', description: 'Envía mensaje de contacto sin autenticación (rate limited)' })
  @ApiResponse({ status: 201, description: 'Mensaje enviado' })
  @ApiResponse({ status: 429, description: 'Demasiadas solicitudes' })
  async createContact(@Body() body: { fullName: string; email: string; subject: string; message: string }) {
    this.logger.log(
      `📧 Mensaje de contacto público de ${body.fullName} (${body.email}) - ` +
      `Asunto: "${body.subject}"`
    );
    
    return this.supportMessagesService.createPublicContact(body);
  }
}
