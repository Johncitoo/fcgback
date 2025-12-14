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
    
    // PRUEBA ULTRA-DIRECTA: Query SQL sin pasar por servicio
    const rawResult = await this.formsService['formsRepo'].manager.query(
      'SELECT * FROM forms WHERE id = $1',
      [id]
    );
    
    if (!rawResult || rawResult.length === 0) {
      throw new Error('Form not found');
    }
    
    const formFromDB = rawResult[0];
    
    this.logger.log(`⚡ DIRECTO DE DB sections: ${formFromDB.schema?.sections?.length || 0}`);
    this.logger.log(`⚡ DIRECTO DE DB section IDs: ${formFromDB.schema?.sections?.map((s: any) => s.id).join(', ') || 'none'}`);
    
    const responseObject = {
      id: formFromDB.id,
      name: formFromDB.name,
      description: formFromDB.description,
      version: formFromDB.version,
      isTemplate: formFromDB.is_template,
      schema: formFromDB.schema,
      createdAt: formFromDB.created_at,
      updatedAt: formFromDB.updated_at
    };
    
    this.logger.log(`⚡ RESPONSE OBJECT sections: ${responseObject.schema?.sections?.length || 0}`);
    this.logger.log(`⚡ RESPONSE OBJECT JSON: ${JSON.stringify(responseObject.schema.sections.map((s: any) => s.id))}`);
    
    // Devolver EXACTAMENTE lo que viene de PostgreSQL
    return responseObject;
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

  // ENDPOINT DE DIAGNÓSTICO - TEMPORAL
  @Get(':id/debug-raw')
  @Roles('ADMIN')
  async debugRaw(@Param('id') id: string) {
    const rawResult = await this.formsService['formsRepo'].manager.query(
      'SELECT id, name, schema FROM forms WHERE id = $1',
      [id]
    );
    
    if (!rawResult || rawResult.length === 0) {
      return { error: 'Form not found' };
    }
    
    const form = rawResult[0];
    const sections = form.schema?.sections || [];
    
    return {
      debug: 'RAW_FROM_POSTGRESQL',
      formId: form.id,
      formName: form.name,
      totalSections: sections.length,
      sectionIds: sections.map((s: any) => s.id),
      sectionTitles: sections.map((s: any) => ({ id: s.id, title: s.title })),
      hasTemporalIds: sections.some((s: any) => s.id.startsWith('tmp_')),
      fullSchema: form.schema
    };
  }
}
