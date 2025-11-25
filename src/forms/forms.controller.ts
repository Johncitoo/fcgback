import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { FormsService } from './forms.service';

@Controller('forms')
export class FormsController {
  constructor(private formsService: FormsService) {}

  @Post()
  create(@Body() data: { name: string; description?: string; isTemplate?: boolean }) {
    return this.formsService.create(data);
  }

  @Get()
  findAll(@Query('isTemplate') isTemplate?: string) {
    const template = isTemplate === 'true' ? true : isTemplate === 'false' ? false : undefined;
    return this.formsService.findAll(template);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.formsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.formsService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.formsService.remove(id);
  }

  @Post(':id/version')
  createVersion(@Param('id') id: string, @Body() changes: any) {
    return this.formsService.createVersion(id, changes);
  }
}
