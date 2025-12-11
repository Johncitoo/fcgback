import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { FormSubmissionsService } from './form-submissions.service';
import { Roles } from '../auth/roles.decorator';
import { CreateFormSubmissionDto } from './dto/create-form-submission.dto';
import { UpdateFormSubmissionDto } from './dto/update-form-submission.dto';
import { SubmitFormDto } from './dto/submit-form.dto';

@Controller('form-submissions')
@Roles('ADMIN', 'REVIEWER')
export class FormSubmissionsController {
  constructor(private submissionsService: FormSubmissionsService) {}

  @Post()
  @Roles('ADMIN', 'REVIEWER', 'APPLICANT')
  create(@Body() data: CreateFormSubmissionDto) {
    return this.submissionsService.create(data);
  }

  @Get('application/:applicationId')
  @Roles('ADMIN', 'REVIEWER', 'APPLICANT')
  findByApplication(@Param('applicationId') applicationId: string) {
    return this.submissionsService.findByApplication(applicationId);
  }

  @Get('milestone/:milestoneId')
  findByMilestone(@Param('milestoneId') milestoneId: string) {
    return this.submissionsService.findByMilestone(milestoneId);
  }

  @Get(':id')
  @Roles('ADMIN', 'REVIEWER', 'APPLICANT')
  findOne(@Param('id') id: string) {
    return this.submissionsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'REVIEWER', 'APPLICANT')
  update(@Param('id') id: string, @Body() data: UpdateFormSubmissionDto) {
    return this.submissionsService.update(id, data);
  }

  @Post(':id/submit')
  @Roles('ADMIN', 'REVIEWER', 'APPLICANT')
  submit(@Param('id') id: string, @Body() data: SubmitFormDto) {
    return this.submissionsService.submit(id, data.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.submissionsService.softDelete(id);
  }
}
