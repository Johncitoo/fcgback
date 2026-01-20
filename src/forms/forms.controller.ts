import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { FormsService } from './forms.service';
import { Roles } from '../auth/roles.decorator';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';

/**
 * Controlador para gestión de formularios en el Form Builder.
 * 
 * Proporciona CRUD completo para formularios:
 * - Crear formularios con esquema JSON (sections + fields)
 * - Listar con filtro por plantillas
 * - Obtener formulario por ID (sin caché)
 * - Actualizar parcialmente
 * - Eliminar formulario
 * - Crear versiones de formularios
 * 
 * Sistema moderno de formularios dinámicos basado en esquema JSON.
 * 
 * Seguridad: ADMIN y REVIEWER (GET by ID permite APPLICANT)
 */
@ApiTags('Forms')
@ApiBearerAuth('JWT-auth')
@Controller('forms')
@Roles('ADMIN', 'REVIEWER')
export class FormsController {
  constructor(private formsService: FormsService) {}

  /**
   * Crea un nuevo formulario en el Form Builder.
   * 
   * @param data - DTO con datos del formulario (name, schema con sections y fields)
   * @returns Formulario creado
   * 
   * @example
   * POST /api/forms
   * Body: { "name": "Formulario de Postulación", "schema": { "sections": [...] } }
   */
  @Post()
  @ApiOperation({ summary: 'Crear formulario', description: 'Crea un nuevo formulario con esquema JSON' })
  @ApiResponse({ status: 201, description: 'Formulario creado' })
  create(@Body() data: CreateFormDto) {
    return this.formsService.create(data);
  }

  /**
   * Lista todos los formularios con filtro opcional por plantillas.
   * 
   * @param isTemplate - Filtro opcional ('true' para plantillas, 'false' para no plantillas)
   * @returns Array de formularios
   * 
   * @example
   * GET /api/forms?isTemplate=true
   */
  @Get()
  @ApiOperation({ summary: 'Listar formularios', description: 'Lista formularios con filtro opcional por plantillas' })
  @ApiQuery({ name: 'isTemplate', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Lista de formularios' })
  findAll(@Query('isTemplate') isTemplate?: string) {
    const template = isTemplate === 'true' ? true : isTemplate === 'false' ? false : undefined;
    return this.formsService.findAll(template);
  }

  /**
   * Obtiene un formulario específico por su ID.
   * Incluye headers para evitar caché.
   * 
   * @param id - ID del formulario
   * @returns Formulario con schema completo
   * 
   * @example
   * GET /api/forms/uuid-123
   */
  @Get(':id')
  @Roles('ADMIN', 'REVIEWER', 'APPLICANT')
  @ApiOperation({ summary: 'Obtener formulario', description: 'Obtiene un formulario específico con su esquema completo' })
  @ApiParam({ name: 'id', description: 'ID del formulario' })
  @ApiResponse({ status: 200, description: 'Formulario con esquema' })
  @ApiResponse({ status: 404, description: 'Formulario no encontrado' })
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @Header('Surrogate-Control', 'no-store')
  async findOne(@Param('id') id: string) {
    console.log(`[FormsController] ⚡ GET /forms/${id} - REQUEST RECEIVED`);
    const form = await this.formsService.findOne(id);
    console.log(`[FormsController] ⚡ GET /forms/${id} - RESPUESTA: ${form.schema?.sections?.length || 0} sections`);
    return form;
  }

  /**
   * Actualiza parcialmente un formulario existente.
   * 
   * @param id - ID del formulario
   * @param data - Campos a actualizar
   * @returns Formulario actualizado
   * 
   * @example
   * PATCH /api/forms/uuid-123
   * Body: { "name": "Nuevo Nombre" }
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar formulario', description: 'Actualiza parcialmente un formulario' })
  @ApiParam({ name: 'id', description: 'ID del formulario' })
  @ApiResponse({ status: 200, description: 'Formulario actualizado' })
  @ApiResponse({ status: 404, description: 'Formulario no encontrado' })
  update(@Param('id') id: string, @Body() data: UpdateFormDto) {
    return this.formsService.update(id, data);
  }

  /**
   * Elimina un formulario por su ID.
   * 
   * @param id - ID del formulario
   * @returns Confirmación de eliminación
   * 
   * @example
   * DELETE /api/forms/uuid-123
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar formulario', description: 'Elimina un formulario por su ID' })
  @ApiParam({ name: 'id', description: 'ID del formulario' })
  @ApiResponse({ status: 200, description: 'Formulario eliminado' })
  remove(@Param('id') id: string) {
    return this.formsService.remove(id);
  }

  /**
   * Crea una nueva versión de un formulario existente.
   * 
   * @param id - ID del formulario base
   * @param changes - Cambios a aplicar en la nueva versión
   * @returns Nueva versión del formulario
   * 
   * @example
   * POST /api/forms/uuid-123/version
   * Body: { "name": "Formulario v2" }
   */
  @Post(':id/version')
  @ApiOperation({ summary: 'Crear versión', description: 'Crea una nueva versión de un formulario existente' })
  @ApiParam({ name: 'id', description: 'ID del formulario base' })
  @ApiResponse({ status: 201, description: 'Nueva versión creada' })
  createVersion(@Param('id') id: string, @Body() changes: UpdateFormDto) {
    return this.formsService.createVersion(id, changes);
  }
}
