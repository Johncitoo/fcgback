import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Header, Logger } from '@nestjs/common';
import { FormsService } from './forms.service';
import { Roles } from '../auth/roles.decorator';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';

@Controller('forms')
@Roles('ADMIN', 'REVIEWER')
export class FormsController {
  private readonly logger = new Logger(FormsController.name);
  constructor(private formsService: FormsService) {}

  @Post()
  create(@Body() data: CreateFormDto) {
    return this.formsService.create(data);
  }

  @Get()
  findAll(@Query('isTemplate') isTemplate?: string) {
    const template = isTemplate === 'true' ? true : isTemplate === 'false' ? false : undefined;
    return this.formsService.findAll(template);
  }

  @Get(':id')
  @Roles('ADMIN', 'REVIEWER', 'APPLICANT')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @Header('Surrogate-Control', 'no-store')
  async findOne(@Param('id') id: string) {
    this.logger.log(`⚡ GET /forms/${id} - REQUEST RECEIVED`);
    const form = await this.formsService.findOne(id);
    this.logger.log(`⚡ GET /forms/${id} - RESPUESTA DEL SERVICIO: ${form.schema?.sections?.length || 0} sections`);
    this.logger.log(`⚡ GET /forms/${id} - IDs de secciones: ${form.schema?.sections?.map((s: any) => s.id).join(', ') || 'none'}`);
    
    // PRUEBA: Devolver objeto plano en lugar de entity
    const plainForm = {
      id: form.id,
      name: form.name,
      description: form.description,
      version: form.version,
      isTemplate: form.isTemplate,
      parentFormId: form.parentFormId,
      schema: form.schema,
      createdAt: form.createdAt,
      updatedAt: form.updatedAt
    };
    
    this.logger.log(`⚡ GET /forms/${id} - PLAIN OBJECT sections: ${plainForm.schema?.sections?.length || 0}`);
    
    return plainForm;
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateFormDto) {
    return this.formsService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.formsService.remove(id);
  }

  @Post(':id/version')
  createVersion(@Param('id') id: string, @Body() changes: UpdateFormDto) {
    return this.formsService.createVersion(id, changes);
  }
}
