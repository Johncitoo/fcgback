import {
  Controller,
  Get,
  Param,
  Query,
  Post,
  Body,
  Patch,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { CallsService } from './calls.service';
import { CallsSchedulerService } from './calls-scheduler.service';
import { Roles } from '../auth/roles.decorator';
import { CreateCallDto } from './dto/create-call.dto';
import { UpdateCallDto } from './dto/update-call.dto';
import { ListCallsDto } from './dto/list-calls.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('calls')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CallsController {
  constructor(
    private calls: CallsService,
    private scheduler: CallsSchedulerService,
  ) {}

  /**
   * Lista todas las convocatorias con filtros y paginación.
   * 
   * @param query - Parámetros de consulta (limit, offset, onlyActive, count)
   * @returns Lista paginada de convocatorias
   * 
   * @example
   * GET /api/calls?limit=10&onlyActive=true
   */
  @Roles('ADMIN', 'REVIEWER')
  @Get()
  async list(@Query() query: ListCallsDto) {
    const limitNum = query.limit ? parseInt(query.limit, 10) : 20;
    const offsetNum = query.offset ? parseInt(query.offset, 10) : 0;
    const needCount = query.count === '1' || query.count === 'true';
    const activeOnly = query.onlyActive === 'true' || query.onlyActive === '1';

    return this.calls.listCalls({
      limit: limitNum,
      offset: offsetNum,
      onlyActive: activeOnly,
      needCount,
    });
  }

  /**
   * Obtiene los detalles completos de una convocatoria específica.
   * 
   * @param id - ID de la convocatoria
   * @returns Detalles de la convocatoria
   * @throws {NotFoundException} Si la convocatoria no existe
   * 
   * @example
   * GET /api/calls/uuid-123
   */
  @Roles('ADMIN', 'REVIEWER')
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.calls.getCallById(id);
  }

  /**
   * Obtiene el formulario asociado a una convocatoria.
   * Prioriza el formulario del Form Builder sobre el formulario viejo (sections/fields).
   * 
   * @param id - ID de la convocatoria
   * @returns Formulario con secciones y campos
   * @throws {NotFoundException} Si la convocatoria no existe
   * 
   * @example
   * GET /api/calls/uuid-123/form
   */
  @Get(':id/form')
  @Roles('ADMIN', 'REVIEWER', 'APPLICANT')
  async getForm(@Param('id') id: string) {
    return this.calls.getForm(id);
  }

  /**
   * Crea una nueva convocatoria.
   * 
   * @param body - Datos de la convocatoria (name, year, status, totalSeats, etc.)
   * @returns Convocatoria creada
   * @throws {BadRequestException} Si faltan campos requeridos
   * 
   * @example
   * POST /api/calls
   * Body: { "name": "BECA2024", "year": 2024, "status": "DRAFT" }
   */
  @Roles('ADMIN', 'REVIEWER')
  @Post()
  async create(@Body() body: CreateCallDto) {
    return this.calls.createCall(body);
  }

  /**
   * Actualiza parcialmente una convocatoria existente.
   * Valida que solo haya una convocatoria activa a la vez.
   * 
   * @param id - ID de la convocatoria
   * @param body - Campos a actualizar
   * @returns Confirmación de actualización
   * @throws {NotFoundException} Si la convocatoria no existe
   * @throws {BadRequestException} Si intenta activar cuando ya hay otra activa
   * 
   * @example
   * PATCH /api/calls/uuid-123
   * Body: { "status": "OPEN", "isActive": true }
   */
  @Roles('ADMIN', 'REVIEWER')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateCallDto) {
    return this.calls.updateCall(id, body);
  }

  /**
   * Ejecuta verificación y actualización automática de estados de convocatorias.
   * 
   * Revisa todas las convocatorias con autoClose habilitado y:
   * - Activa las que hayan alcanzado su start_date
   * - Cierra las que hayan superado su end_date
   * 
   * Este endpoint puede ser llamado manualmente o desde un cron externo.
   * 
   * @returns Estadísticas de actualizaciones realizadas
   * 
   * @example
   * POST /api/calls/check-statuses
   * Response: { activated: 2, closed: 1, checked: 45 }
   */
  @Roles('ADMIN')
  @Post('check-statuses')
  async checkStatuses() {
    return this.scheduler.checkAndUpdateCallStatuses();
  }
}
