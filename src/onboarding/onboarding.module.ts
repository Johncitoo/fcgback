import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';
import { InvitesController } from './invites.controller';
import { Invite } from './entities/invite.entity';
import { PasswordSetToken } from './entities/password-set-token.entity';
import { UsersModule } from '../users/users.module';
import { CallsModule } from '../calls/calls.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invite, PasswordSetToken]),
    UsersModule,
    CallsModule,
  ],
  controllers: [OnboardingController, InvitesController],
  providers: [OnboardingService],
  exports: [OnboardingService], // ← Importante: exportar el servicio
})
export class OnboardingModule {}
