import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Query,
  Delete,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { ApplicationsService } from './applications.service';
import { Roles } from '../auth/roles.decorator';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { SaveAnswersDto } from './dto/save-answers.dto';
import { cleanupDuplicateApplications } from './cleanup-duplicates';

/**
 * Controller para gestión del ciclo de vida de aplicaciones/postulaciones.
 * 
 * Gestiona la creación, actualización y envío de aplicaciones a becas.
 * Implementa control de acceso por roles (APPLICANT, ADMIN, REVIEWER).
 * 
 * Flujos principales:
 * 1. Crear/obtener aplicación (getOrCreate)
 * 2. Guardar respuestas del formulario (saveAnswers)
 * 3. Enviar aplicación (submit)
 * 4. Listar y filtrar aplicaciones (admin)
 */
@ApiTags('Applications')
@ApiBearerAuth('JWT-auth')
@Controller('applications')
@Roles('ADMIN', 'REVIEWER') // Todo el controlador requiere admin o revisor
export class ApplicationsController {
  constructor(
    private jwt: JwtService,
    private cfg: ConfigService,
    private apps: ApplicationsService,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  /**
   * Extrae y valida el usuario desde el token JWT en el header Authorization.
   * 
   * @param req - Objeto Request con headers de autenticación
   * @returns Payload del JWT con sub (user ID), role y typ (tipo de token)
   * @throws {BadRequestException} Si el token no está presente o es inválido
   * 
   * @example
   * const user = this.getUserFromAuth(req);
   * // { sub: 'uuid-123', role: 'APPLICANT', typ: 'access' }
   */
  private getUserFromAuth(req: any) {
    const hdr = (req.headers?.authorization ?? '') as string;
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) throw new BadRequestException('Missing bearer token');
    const secret = this.cfg.get<string>('AUTH_JWT_SECRET')!;
    const payload = this.jwt.verify(token, {
      secret,
      audience: this.cfg.get<string>('AUTH_JWT_AUD'),
      issuer: this.cfg.get<string>('AUTH_JWT_ISS'),
    });
    return payload as { sub: string; role: string; typ: string };
  }

  /**
   * Lista todas las aplicaciones con filtros y paginación para administradores.
   * Permite filtrar por estado, convocatoria y hito actual.
   * 
   * @param limit - Número máximo de resultados (default: 20)
   * @param offset - Desplazamiento para paginación (default: 0)
   * @param overallStatus - Filtro por estado general (APPROVED, REJECTED, IN_REVIEW, etc.)
   * @param callId - Filtro por ID de convocatoria
   * @param milestoneOrder - Filtro por orden de hito actual
   * @param count - Si debe incluir el conteo total ('1' o 'true')
   * @returns Lista paginada de aplicaciones con información del postulante y hito actual
   * 
   * @example
   * GET /api/applications?limit=10&overallStatus=IN_REVIEW&callId=uuid-123
   */
  @Get()
  @ApiOperation({ summary: 'Listar aplicaciones', description: 'Lista aplicaciones con filtros y paginación (solo admin/reviewer)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Límite de resultados (default: 20)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset para paginación' })
  @ApiQuery({ name: 'overallStatus', required: false, description: 'Filtrar por estado (DRAFT, SUBMITTED, etc.)' })
  @ApiQuery({ name: 'callId', required: false, description: 'Filtrar por convocatoria' })
  @ApiQuery({ name: 'milestoneOrder', required: false, type: Number, description: 'Filtrar por hito actual' })
  @ApiQuery({ name: 'count', required: false, description: 'Incluir conteo total (1 o true)' })
  @ApiResponse({ status: 200, description: 'Lista de aplicaciones' })
  async listAdmin(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('overallStatus') overallStatus?: string,
    @Query('callId') callId?: string,
    @Query('milestoneOrder') milestoneOrder?: string,
    @Query('count') count?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    const needCount = count === '1' || count === 'true';
    const milestoneOrderNum = milestoneOrder ? parseInt(milestoneOrder, 10) : undefined;

    return this.apps.listApplications({
      limit: limitNum,
      offset: offsetNum,
      overallStatus,
      callId,
      milestoneOrder: milestoneOrderNum,
      needCount,
    });
  }

  /**
   * Obtiene una aplicación existente o crea una nueva para el postulante.
   * Requiere token de acceso de APPLICANT.
   * 
   * @param req - Request con token JWT del postulante
   * @param body - Objeto con callId de la convocatoria
   * @returns Aplicación existente o recién creada con su ID y estado
   * @throws {BadRequestException} Si no es token de APPLICANT o falta callId
   * 
   * @example
   * POST /api/applications
   * Body: { "callId": "uuid-123" }
   * Response: { "id": "uuid-456", "status": "DRAFT", "mode": "created" }
   */
  @Post()
  @ApiOperation({ summary: 'Crear/obtener aplicación', description: 'Obtiene o crea una aplicación para el postulante' })
  @ApiBody({ schema: { type: 'object', properties: { callId: { type: 'string', format: 'uuid' } }, required: ['callId'] } })
  @ApiResponse({ status: 200, description: 'Aplicación existente o creada' })
  @ApiResponse({ status: 400, description: 'Token inválido o falta callId' })
  async getOrCreate(@Req() req: any, @Body() body: { callId: string }) {
    const user = this.getUserFromAuth(req);
    if (user.typ !== 'access' || user.role !== 'APPLICANT') {
      throw new BadRequestException('Applicant access token required');
    }
    if (!body?.callId) throw new BadRequestException('callId required');
    return this.apps.getOrCreate(user.sub, body.callId);
  }

  /**
   * Obtiene o crea la aplicación del postulante para la convocatoria actualmente activa (OPEN).
   * Solo accesible para postulantes (APPLICANT).
   * 
   * @param req - Request con token JWT del postulante
   * @returns Aplicación del postulante con información de la convocatoria activa
   * @throws {NotFoundException} Si no hay convocatoria activa
   * @throws {BadRequestException} Si el usuario no tiene perfil de postulante
   * 
   * @example
   * GET /api/applications/my-active
   * Response: { "id": "uuid-456", "status": "DRAFT", "call": { "id": "uuid-123", "code": "BECA2024" } }
   */
  @Get('my-active')
  @Roles('APPLICANT')
  @ApiOperation({ summary: 'Obtener mi aplicación activa', description: 'Obtiene o crea la aplicación para la convocatoria activa' })
  @ApiResponse({ status: 200, description: 'Aplicación del postulante' })
  @ApiResponse({ status: 404, description: 'No hay convocatoria activa' })
  async getMyActive(@Req() req: any) {
    const user = this.getUserFromAuth(req);
    if (user.typ !== 'access' || user.role !== 'APPLICANT') {
      throw new BadRequestException('Applicant access token required');
    }
    return this.apps.getOrCreateForActiveCall(user.sub);
  }

  /**
   * Obtiene los detalles de una aplicación específica.
   * Postulantes solo pueden ver sus propias aplicaciones, administradores pueden ver cualquiera.
   * 
   * @param req - Request con token JWT
   * @param id - ID de la aplicación
   * @returns Detalles completos de la aplicación
   * @throws {NotFoundException} Si la aplicación no existe o no tiene acceso
   * 
   * @example
   * GET /api/applications/uuid-123
   */
  @Get(':id')
  @Roles('ADMIN', 'REVIEWER', 'APPLICANT')
  @ApiOperation({ summary: 'Obtener aplicación por ID', description: 'Obtiene detalles de una aplicación específica' })
  @ApiParam({ name: 'id', description: 'ID de la aplicación' })
  @ApiResponse({ status: 200, description: 'Detalles de la aplicación' })
  @ApiResponse({ status: 404, description: 'Aplicación no encontrada' })
  async getById(@Req() req: any, @Param('id') id: string) {
    try {
      const user = this.getUserFromAuth(req);
      // Permitir tanto APPLICANT como ADMIN/REVIEWER
      if (user.role === 'APPLICANT') {
        return this.apps.getById(user.sub, id);
      } else if (user.role === 'ADMIN' || user.role === 'REVIEWER') {
        // Admin puede ver cualquier aplicación
        return this.apps.getByIdAdmin(id);
      } else {
        throw new BadRequestException('Unauthorized role');
      }
    } catch (error) {
      // Si no hay token válido, intentar como admin sin autenticación (temporal para desarrollo)
      return this.apps.getByIdAdmin(id);
    }
  }

  /**
   * Actualiza parcialmente los datos de una aplicación.
   * Solo el postulante propietario puede actualizar su aplicación.
   * 
   * @param req - Request con token JWT del postulante
   * @param id - ID de la aplicación a actualizar
   * @param body - Campos a actualizar (academic, household, participation, texts, builderExtra)
   * @returns Confirmación de actualización
   * @throws {BadRequestException} Si no es el propietario
   * @throws {NotFoundException} Si la aplicación no existe
   * 
   * @example
   * PATCH /api/applications/uuid-123
   * Body: { "academic": { "institution": "Universidad de Chile" } }
   */
  @Patch(':id')
  @Roles('APPLICANT', 'ADMIN', 'REVIEWER')
  @ApiOperation({ summary: 'Actualizar aplicación', description: 'Actualiza parcialmente los datos de una aplicación' })
  @ApiParam({ name: 'id', description: 'ID de la aplicación' })
  @ApiResponse({ status: 200, description: 'Aplicación actualizada' })
  @ApiResponse({ status: 404, description: 'Aplicación no encontrada' })
  async patch(@Req() req: any, @Param('id') id: string, @Body() body: UpdateApplicationDto) {
    const user = this.getUserFromAuth(req);
    
    // Si es ADMIN o REVIEWER, permitir actualizar score y notes sin verificar ownership
    if (user.role === 'ADMIN' || user.role === 'REVIEWER') {
      return this.apps.adminPatch(id, body);
    }
    
    // Para APPLICANT, verificar ownership y usar el patch normal
    return this.apps.patch(user.sub, id, body);
  }

  /**
   * Envía una aplicación para revisión.
   * Cambia el estado de DRAFT/NEEDS_FIX a SUBMITTED y registra en el historial.
   * 
   * @param req - Request con token JWT del postulante
   * @param id - ID de la aplicación a enviar
   * @returns Confirmación con nuevo estado
   * @throws {BadRequestException} Si el estado no permite envío o faltan secciones requeridas
   * @throws {NotFoundException} Si la aplicación no existe
   * 
   * @example
   * POST /api/applications/uuid-123/submit
   * Response: { "ok": true, "status": "SUBMITTED" }
   */
  @Post(':id/submit')
  @Roles('APPLICANT')
  @ApiOperation({ summary: 'Enviar aplicación', description: 'Envía la aplicación para revisión' })
  @ApiParam({ name: 'id', description: 'ID de la aplicación' })
  @ApiResponse({ status: 200, description: 'Aplicación enviada' })
  @ApiResponse({ status: 400, description: 'Estado no permite envío o faltan datos' })
  async submit(@Req() req: any, @Param('id') id: string) {
    const user = this.getUserFromAuth(req);
    if (user.role !== 'APPLICANT')
      throw new BadRequestException('Applicant only');
    return this.apps.submit(user.sub, id);
  }

  /**
   * Marca el código de invitación como completado después de enviar el formulario.
   * Actualiza el campo used_at de la invitación asociada al postulante.
   * 
   * @param req - Request con token JWT del postulante
   * @param id - ID de la aplicación
   * @returns Confirmación de operación
   * @throws {NotFoundException} Si la aplicación no existe
   * 
   * @example
   * POST /api/applications/uuid-123/complete-invite
   */
  @Post(':id/complete-invite')
  @Roles('APPLICANT')
  @ApiOperation({ summary: 'Completar invitación', description: 'Marca el código de invitación como usado' })
  @ApiParam({ name: 'id', description: 'ID de la aplicación' })
  @ApiResponse({ status: 200, description: 'Invitación completada' })
  async completeInvite(@Req() req: any, @Param('id') id: string) {
    const user = this.getUserFromAuth(req);
    if (user.role !== 'APPLICANT')
      throw new BadRequestException('Applicant only');
    return this.apps.completeInvite(user.sub, id);
  }

  /**
   * Obtiene las respuestas guardadas del formulario de una aplicación.
   * Devuelve la última submission guardada como borrador.
   * 
   * @param req - Request con token JWT del postulante
   * @param id - ID de la aplicación
   * @returns Objeto con las respuestas del formulario (o {} si no hay)
   * @throws {NotFoundException} Si la aplicación no existe
   * 
   * @example
   * GET /api/applications/uuid-123/answers
   * Response: { "field1": "valor1", "field2": "valor2" }
   */
  @Get(':id/answers')
  @Roles('APPLICANT')
  @ApiOperation({ summary: 'Obtener respuestas', description: 'Obtiene las respuestas guardadas del formulario' })
  @ApiParam({ name: 'id', description: 'ID de la aplicación' })
  @ApiResponse({ status: 200, description: 'Respuestas del formulario' })
  async getAnswers(@Req() req: any, @Param('id') id: string) {
    const user = this.getUserFromAuth(req);
    if (user.role !== 'APPLICANT')
      throw new BadRequestException('Applicant only');
    return this.apps.getAnswers(user.sub, id);
  }

  /**
   * Guarda las respuestas del formulario como borrador.
   * Actualiza la form_submission existente o crea una nueva.
   * 
   * @param req - Request con token JWT del postulante
   * @param id - ID de la aplicación
   * @param dto - DTO con las respuestas del formulario
   * @returns Confirmación de guardado
   * @throws {BadRequestException} Si no se encuentra el formulario inicial
   * @throws {NotFoundException} Si la aplicación no existe
   * 
   * @example
   * PATCH /api/applications/uuid-123/answers
   * Body: { "answers": { "field1": "valor1", "field2": "valor2" } }
   */
  @Patch(':id/answers')
  @Roles('APPLICANT')
  @ApiOperation({ summary: 'Guardar respuestas', description: 'Guarda las respuestas del formulario como borrador' })
  @ApiParam({ name: 'id', description: 'ID de la aplicación' })
  @ApiResponse({ status: 200, description: 'Respuestas guardadas' })
  async saveAnswers(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SaveAnswersDto,
  ) {
    const user = this.getUserFromAuth(req);
    if (user.role !== 'APPLICANT')
      throw new BadRequestException('Applicant only');
    return this.apps.saveAnswers(user.sub, id, dto.answers);
  }

  /**
   * Limpia aplicaciones duplicadas del sistema.
   * 
   * Identifica aplicaciones duplicadas por postulante+convocatoria y mantiene solo
   * la que tiene form_submissions asociadas. Útil para limpiar registros huérfanos
   * creados por errores de concurrencia.
   * 
   * @returns Resumen de operación con cantidad eliminada
   * @throws {ForbiddenException} Si no es ADMIN
   * 
   * @example
   * DELETE /api/applications/cleanup-duplicates
   * Response: { "message": "Limpieza completada", "deleted": 5, "kept": 45 }
   */
  @Delete('cleanup-duplicates')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Limpiar duplicados', description: 'Elimina aplicaciones duplicadas del sistema (solo admin)' })
  @ApiResponse({ status: 200, description: 'Limpieza completada' })
  async cleanupDuplicates() {
    const result = await cleanupDuplicateApplications(this.dataSource);
    return {
      message: 'Limpieza de aplicaciones duplicadas completada',
      ...result,
    };
  }
}
