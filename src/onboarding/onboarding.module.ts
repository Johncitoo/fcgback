import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';
import { Invite } from './entities/invite.entity';
import { PasswordSetToken } from './entities/password-set-token.entity';
import { UsersModule } from '../users/users.module';
import { SessionsModule } from '../sessions/sessions.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invite, PasswordSetToken]),
    UsersModule,
    SessionsModule,
    JwtModule.register({}), // usamos AuthService-style, config viene vía ConfigService
  ],
  providers: [OnboardingService],
  controllers: [OnboardingController],
})
export class OnboardingModule {}
