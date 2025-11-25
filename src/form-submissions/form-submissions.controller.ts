import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { FormSubmissionsService } from './form-submissions.service';

@Controller('form-submissions')
export class FormSubmissionsController {
  constructor(private submissionsService: FormSubmissionsService) {}

  @Post()
  create(@Body() data: any) {
    return this.submissionsService.create(data);
  }

  @Get('application/:applicationId')
  findByApplication(@Param('applicationId') applicationId: string) {
    return this.submissionsService.findByApplication(applicationId);
  }

  @Get('milestone/:milestoneId')
  findByMilestone(@Param('milestoneId') milestoneId: string) {
    return this.submissionsService.findByMilestone(milestoneId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.submissionsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.submissionsService.update(id, data);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @Body() data: { userId: string }) {
    return this.submissionsService.submit(id, data.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.submissionsService.softDelete(id);
  }
}
