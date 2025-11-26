import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { CommonModule } from './common/common.module';
import { UsersModule } from './users/users.module';
import { SessionsModule } from './sessions/sessions.module';
import { AuthModule } from './auth/auth.module';
import { OnboardingModule } from './onboarding/onboarding.module';

import { FormModule } from './form/form.module';
import { ProfileModule } from './profile/profile.module';
import { ApplicationsModule } from './applications/applications.module';
import { CallsModule } from './calls/calls.module';

import { DocumentsModule } from './documents/documents.module';
import { EmailModule } from './email/email.module';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { InvitesModule } from './invites/invites.module';
import { InstitutionsModule } from './institutions/institutions.module';
import { StorageClientModule } from './storage-client/storage-client.module';
import { FormsModule } from './forms/forms.module';
import { MilestonesModule } from './milestones/milestones.module';
import { FormSubmissionsModule } from './form-submissions/form-submissions.module';
import { ApplicantsModule } from './applicants/applicants.module';

@Module({
  imports: [
    // Carga variables de entorno y las deja disponibles globalmente
    ConfigModule.forRoot({
      isGlobal: true,
      // En Docker ya inyectamos el .env.local vía compose; esto no estorba si existe
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate Limiting (Throttling)
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 segundo
        limit: 10, // 10 requests por segundo
      },
      {
        name: 'medium',
        ttl: 60000, // 1 minuto
        limit: 100, // 100 requests por minuto
      },
      {
        name: 'long',
        ttl: 900000, // 15 minutos
        limit: 500, // 500 requests por 15 minutos
      },
    ]),

    // TypeORM (usamos DATABASE_URL del .env / compose)
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const url = cfg.get<string>('DATABASE_URL');
        if (!url) throw new Error('DATABASE_URL not set');

        const ssl =
          (cfg.get<string>('DATABASE_SSL') ?? '').toLowerCase() === 'true'
            ? { rejectUnauthorized: false }
            : false;

        return {
          type: 'postgres', // IMPORTANTE: fija el driver
          url,
          ssl,
          autoLoadEntities: true, // carga entidades de todos los módulos
          synchronize: false, // usamos SQL/init/migraciones
          keepConnectionAlive: true, // evita reconexiones en hot-reload
          // logging: true,               // habilítalo para depurar SQL
        };
      },
    }),

    CommonModule,
    UsersModule,
    SessionsModule,
    AuthModule,
    OnboardingModule,
    FormModule,
    ProfileModule,
    ApplicationsModule,
    CallsModule,
    DocumentsModule,
    EmailModule,
    InvitesModule,
    InstitutionsModule,
    StorageClientModule,
    FormsModule,
    MilestonesModule,
    FormSubmissionsModule,
    ApplicantsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Aplicar throttling globalmente
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
