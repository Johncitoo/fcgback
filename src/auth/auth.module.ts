import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { SessionsModule } from '../sessions/sessions.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { JwtAuthGuard } from './jwt-auth.guard';

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
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
