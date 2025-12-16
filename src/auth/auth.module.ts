import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { SessionsModule } from '../sessions/sessions.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { EmailModule } from '../email/email.module';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SecurityService } from '../common/security.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const expiresIn = config.get<string>('AUTH_JWT_EXPIRES', '900s');
        return {
          secret: config.get<string>('AUTH_JWT_SECRET'),
          signOptions: {
            expiresIn: expiresIn as any, // Cast para compatibilidad con versiones de @nestjs/jwt
          },
        };
      },
    }),
    UsersModule,
    SessionsModule,
    OnboardingModule,
    EmailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, SecurityService],
  exports: [AuthService, JwtAuthGuard, JwtModule, SecurityService],
})
export class AuthModule {}
