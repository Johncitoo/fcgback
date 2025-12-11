import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';
import { InvitesController } from './invites.controller';
import { Invite } from './entities/invite.entity';
import { PasswordSetToken } from './entities/password-set-token.entity';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { CallsModule } from '../calls/calls.module';
import { EmailModule } from '../email/email.module';
import { MilestonesModule } from '../milestones/milestones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invite, PasswordSetToken, User]),
    UsersModule,
    forwardRef(() => CallsModule),
    EmailModule,
    MilestonesModule,
  ],
  controllers: [OnboardingController, InvitesController],
  providers: [OnboardingService],
  exports: [OnboardingService], // ← Importante: exportar el servicio
})
export class OnboardingModule {}
