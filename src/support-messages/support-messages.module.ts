import { Module } from '@nestjs/common';
import { SupportMessagesController } from './support-messages.controller';
import { SupportMessagesService } from './support-messages.service';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [EmailModule, UsersModule],
  controllers: [SupportMessagesController],
  providers: [SupportMessagesService],
  exports: [SupportMessagesService],
})
export class SupportMessagesModule {}
