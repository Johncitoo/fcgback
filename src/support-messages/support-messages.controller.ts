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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SupportMessagesService } from './support-messages.service';
import type { CreateSupportMessageDto } from './support-messages.service';

/**
 * Controlador para mensajes de soporte/ayuda de postulantes (requiere autenticación).
 * 
 * Endpoints:
 * - POST /api/support-messages - Crear nuevo mensaje (APPLICANT, REVIEWER, ADMIN)
 * - GET /api/support-messages - Listar todos (ADMIN)
 * - GET /api/support-messages/application/:id - Mensajes de una app (ADMIN)
 * - PATCH /api/support-messages/:id/status - Actualizar estado (ADMIN)
 */
@ApiTags('Support Messages')
@ApiBearerAuth('JWT-auth')
@Controller('support-messages')
export class SupportMessagesController {
  private readonly logger = new Logger(SupportMessagesController.name);

  constructor(private readonly supportMessagesService: SupportMessagesService) {}

  /**
   * Crea un nuevo mensaje de soporte (requiere autenticación).
   * Cualquier usuario autenticado puede enviar un mensaje.
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('APPLICANT', 'REVIEWER', 'ADMIN')
  @ApiOperation({ summary: 'Crear mensaje', description: 'Crea un nuevo mensaje de soporte' })
  @ApiResponse({ status: 201, description: 'Mensaje creado' })
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
  @ApiOperation({ summary: 'Listar mensajes', description: 'Lista todos los mensajes de soporte' })
  @ApiQuery({ name: 'status', required: false, description: 'Filtrar por estado' })
  @ApiResponse({ status: 200, description: 'Lista de mensajes' })
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
  @ApiOperation({ summary: 'Mensajes por aplicación', description: 'Obtiene mensajes de una aplicación específica' })
  @ApiParam({ name: 'id', description: 'ID de la aplicación' })
  @ApiResponse({ status: 200, description: 'Mensajes de la aplicación' })
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
  @ApiOperation({ summary: 'Actualizar estado', description: 'Actualiza el estado de un mensaje' })
  @ApiParam({ name: 'id', description: 'ID del mensaje' })
  @ApiResponse({ status: 200, description: 'Estado actualizado' })
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
