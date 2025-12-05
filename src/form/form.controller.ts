import { Controller, Get, Param, Patch, Body } from '@nestjs/common';
import { FormService } from './form.service';
import { SaveApplicantFormDto } from './dto/save-applicant-form.dto';

@Controller('calls')
export class FormController {
  constructor(private form: FormService) {}

  @Get(':callId/form')
  async getForm(@Param('callId') callId: string) {
    return this.form.getForm(callId);
  }

  @Get('applicant/:applicantId/form/active')
  async getActiveApplicantForm(@Param('applicantId') applicantId: string) {
    return this.form.getActiveApplicantForm(applicantId);
  }

  // PATCH /api/calls/applicant/application/:applicationId/save  (guardar borrador)
  @Patch('applicant/application/:applicationId/save')
  async saveApplicantForm(
    @Param('applicationId') applicationId: string,
    @Body() body: SaveApplicantFormDto,
  ) {
    return this.form.saveApplicantForm(applicationId, body);
  }
}

// Nuevo controlador para obtener formularios por ID
@Controller('forms')
export class FormsController {
  constructor(private form: FormService) {}

  @Get(':formId')
  async getFormById(@Param('formId') formId: string) {
    return this.form.getFormById(formId);
  }
}
