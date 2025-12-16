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
import { Roles } from '../auth/roles.decorator';
import { CreateCallDto } from './dto/create-call.dto';
import { UpdateCallDto } from './dto/update-call.dto';
import { ListCallsDto } from './dto/list-calls.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('calls')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CallsController {
  constructor(private calls: CallsService) {}

  // GET /api/calls - Lista de convocatorias
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

  // GET /api/calls/:id - Obtener detalles de una convocatoria
  @Roles('ADMIN', 'REVIEWER')
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.calls.getCallById(id);
  }

  // GET /api/calls/:id/form - Obtener formulario de una convocatoria
  @Get(':id/form')
  @Roles('ADMIN', 'REVIEWER', 'APPLICANT')
  async getForm(@Param('id') id: string) {
    return this.calls.getForm(id);
  }

  // POST /api/calls - Crear nueva convocatoria
  @Roles('ADMIN', 'REVIEWER')
  @Post()
  async create(@Body() body: CreateCallDto) {
    return this.calls.createCall(body);
  }

  // PATCH /api/calls/:id - Actualizar convocatoria
  @Roles('ADMIN', 'REVIEWER')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateCallDto) {
    return this.calls.updateCall(id, body);
  }
}
