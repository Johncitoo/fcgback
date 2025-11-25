import {
  Controller,
  Get,
  Param,
  Query,
  Post,
  Body,
  Patch,
  BadRequestException,
} from '@nestjs/common';
import { CallsService } from './calls.service';

@Controller('calls')
export class CallsController {
  constructor(private calls: CallsService) {}

  // GET /api/calls - Lista de convocatorias
  @Get()
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('onlyActive') onlyActive?: string,
    @Query('count') count?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    const needCount = count === '1' || count === 'true';
    const activeOnly = onlyActive === 'true' || onlyActive === '1';

    return this.calls.listCalls({
      limit: limitNum,
      offset: offsetNum,
      onlyActive: activeOnly,
      needCount,
    });
  }

  // GET /api/calls/:id - Obtener detalles de una convocatoria
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.calls.getCallById(id);
  }

  // GET /api/calls/:id/form - Obtener formulario de una convocatoria
  @Get(':id/form')
  async getForm(@Param('id') id: string) {
    return this.calls.getForm(id);
  }

  // POST /api/calls - Crear nueva convocatoria
  @Post()
  async create(@Body() body: any) {
    return this.calls.createCall(body);
  }

  // PATCH /api/calls/:id - Actualizar convocatoria
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.calls.updateCall(id, body);
  }
}
