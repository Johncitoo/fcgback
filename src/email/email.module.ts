import { Module } from '@nestjs/common';
import { EmailTemplatesController } from './email-templates.controller';
import { EmailLogsController } from './email-logs.controller';
import { EmailQuotaController } from './email-quota.controller';
import { EmailService } from './email.service';

@Module({
  controllers: [EmailTemplatesController, EmailLogsController, EmailQuotaController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
