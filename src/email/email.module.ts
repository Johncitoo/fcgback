import { Module } from '@nestjs/common';
import { EmailTemplatesController } from './email-templates.controller';
import { EmailLogsController } from './email-logs.controller';

@Module({
  controllers: [EmailTemplatesController, EmailLogsController],
})
export class EmailModule {}
