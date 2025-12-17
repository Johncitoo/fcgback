import { Module } from '@nestjs/common';
import { SupportMessagesController } from './support-messages.controller';
import { PublicContactController } from './public-contact.controller';
import { SupportMessagesService } from './support-messages.service';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, EmailModule, UsersModule],
  controllers: [PublicContactController, SupportMessagesController],
  providers: [SupportMessagesService],
  exports: [SupportMessagesService],
})
export class SupportMessagesModule {}
