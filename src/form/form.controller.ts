import { Controller, Get, Param } from '@nestjs/common';
import { FormService } from './form.service';

@Controller('calls')
export class FormController {
  constructor(private form: FormService) {}

  @Get(':callId/form')
  async getForm(@Param('callId') callId: string) {
    return this.form.getForm(callId);
  }
}
