import { Controller, Get, Param } from '@nestjs/common';
import { CallsService } from './calls.service';

@Controller('calls') // <-- sin /api
export class CallsController {
  constructor(private calls: CallsService) {}

  @Get(':id/form')
  async getForm(@Param('id') id: string) {
    return this.calls.getForm(id);
  }
}
