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
import { SupportMessagesService, CreateSupportMessageDto } from './support-messages.service';

/**
 * Controlador para mensajes de soporte/ayuda de postulantes.
 * 
 * Endpoints:
 * - POST /api/support-messages - Crear nuevo mensaje (APPLICANT, REVIEWER, ADMIN)
 * - GET /api/support-messages - Listar todos (ADMIN)
 * - GET /api/support-messages/application/:id - Mensajes de una app (ADMIN)
 * - PATCH /api/support-messages/:id/status - Actualizar estado (ADMIN)
 */
@Controller('support-messages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupportMessagesController {
  private readonly logger = new Logger(SupportMessagesController.name);

  constructor(private readonly supportMessagesService: SupportMessagesService) {}

  /**
   * Crea un nuevo mensaje de soporte.
   * Cualquier usuario autenticado puede enviar un mensaje.
   */
  @Post()
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
  @Roles('ADMIN')
  async findAll(@Query('status') status?: string) {
    return this.supportMessagesService.findAll(status);
  }

  /**
   * Obtiene mensajes de soporte de una aplicación específica.
   * Solo admins pueden ver los mensajes.
   */
  @Get('application/:id')
  @Roles('ADMIN')
  async findByApplication(@Param('id') applicationId: string) {
    return this.supportMessagesService.findByApplication(applicationId);
  }

  /**
   * Actualiza el estado de un mensaje de soporte.
   * Solo admins pueden actualizar.
   */
  @Patch(':id/status')
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
