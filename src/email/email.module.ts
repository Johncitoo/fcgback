import { Module } from '@nestjs/common';
import { EmailTemplatesController } from './email-templates.controller';
import { EmailLogsController } from './email-logs.controller';
import { EmailQuotaController } from './email-quota.controller';
import { AnnouncementsController } from './announcements.controller';
import { EmailService } from './email.service';
import { TemplateRendererService } from './template-renderer.service';

@Module({
  controllers: [
    EmailTemplatesController, 
    EmailLogsController, 
    EmailQuotaController,
    AnnouncementsController,
  ],
  providers: [EmailService, TemplateRendererService],
  exports: [EmailService, TemplateRendererService],
})
export class EmailModule {}
