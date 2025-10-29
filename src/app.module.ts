import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from './users/users.module';
import { SessionsModule } from './sessions/sessions.module';
import { AuthModule } from './auth/auth.module';
import { OnboardingModule } from './onboarding/onboarding.module';

import { FormModule } from './form/form.module';
import { ProfileModule } from './profile/profile.module';
import { ApplicationsModule } from './applications/applications.module';
import { CallsModule } from './calls/calls.module';

import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [
    // Carga variables de entorno y las deja disponibles globalmente
    ConfigModule.forRoot({
      isGlobal: true,
      // En Docker ya inyectamos el .env.local vía compose; esto no estorba si existe
      envFilePath: ['.env.local', '.env'],
    }),

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
          type: 'postgres',               // IMPORTANTE: fija el driver
          url,
          ssl,
          autoLoadEntities: true,         // carga entidades de todos los módulos
          synchronize: false,             // usamos SQL/init/migraciones
          keepConnectionAlive: true,      // evita reconexiones en hot-reload
          // logging: true,               // habilítalo para depurar SQL
        };
      },
    }),

    UsersModule,
    SessionsModule,
    AuthModule,
    OnboardingModule,
    FormModule,
    ProfileModule,
    ApplicationsModule,
    CallsModule,
    DocumentsModule,
  ],
})
export class AppModule {}
