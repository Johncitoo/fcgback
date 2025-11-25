import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { SessionsModule } from '../sessions/sessions.module';
import { OnboardingModule } from '../onboarding/onboarding.module';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    UsersModule,
    SessionsModule,
    OnboardingModule, // Agregar este módulo
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
