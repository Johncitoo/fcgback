import { 
  Controller, 
  Get, 
  Post, 
  Patch,
  Body, 
  Param, 
  Query,
  UseGuards,
  Req,
  Logger 
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SupportMessagesService } from './support-messages.service';
import type { CreateSupportMessageDto } from './support-messages.service';

/**
 * Controlador para mensajes de soporte/ayuda de postulantes.
 * 
 * Endpoints:
 * - POST /api/support-messages/contact - Contacto público sin autenticación
 * - POST /api/support-messages - Crear nuevo mensaje (APPLICANT, REVIEWER, ADMIN)
 * - GET /api/support-messages - Listar todos (ADMIN)
 * - GET /api/support-messages/application/:id - Mensajes de una app (ADMIN)
 * - PATCH /api/support-messages/:id/status - Actualizar estado (ADMIN)
 */
@Controller('support-messages')
export class SupportMessagesController {
  private readonly logger = new Logger(SupportMessagesController.name);

  constructor(private readonly supportMessagesService: SupportMessagesService) {}

  /**
   * Endpoint público para contacto desde login (sin autenticación).
   * Para personas que necesitan ayuda antes de iniciar sesión.
   */
  @Post('contact')
  async createContact(@Body() body: { fullName: string; email: string; subject: string; message: string }) {
    this.logger.log(
      `📧 Mensaje de contacto público de ${body.fullName} (${body.email}) - ` +
      `Asunto: "${body.subject}"`
    );
    
    return this.supportMessagesService.createPublicContact(body);
  }

  /**
   * Crea un nuevo mensaje de soporte (requiere autenticación).
   * Cualquier usuario autenticado puede enviar un mensaje.
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('APPLICANT', 'REVIEWER', 'ADMIN')
  async create(@Body() dto: CreateSupportMessageDto, @Req() req: any) {
    this.logger.log(
      `📨 Nuevo mensaje de soporte de usuario ${req.user.email} - ` +
      `Asunto: "${dto.subject}"`
    );
    
    return this.supportMessagesService.create(dto);
  }

  /**
   * Obtiene todos los mensajes de soporte.
   * Solo admins pueden ver todos los mensajes.
   * Query params: ?status=OPEN|IN_PROGRESS|RESOLVED|CLOSED
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async findAll(@Query('status') status?: string) {
    return this.supportMessagesService.findAll(status);
  }

  /**
   * Obtiene mensajes de soporte de una aplicación específica.
   * Solo admins pueden ver los mensajes.
   */
  @Get('application/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async findByApplication(@Param('id') applicationId: string) {
    return this.supportMessagesService.findByApplication(applicationId);
  }

  /**
   * Actualiza el estado de un mensaje de soporte.
   * Solo admins pueden actualizar.
   */
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'; adminNotes?: string },
    @Req() req: any
  ) {
    return this.supportMessagesService.updateStatus(
      id,
      body.status,
      req.user.sub,
      body.adminNotes
    );
  }
}
