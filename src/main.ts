import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import helmet from 'helmet';
import * as hpp from 'hpp';
import { AppModule } from './app.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const isProduction = config.get<string>('NODE_ENV') === 'production';

  // Seguridad: Helmet con CSP mejorado
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
  }));
  
  // Seguridad: HPP Protection (HTTP Parameter Pollution)
  app.use(hpp());
  
  console.log('✓ FCG Backend iniciando - v1.0.1');

  // CORS configurado correctamente (NO abierto completamente)
  const allowedOrigins = config.get<string>('CORS_ORIGINS')?.split(',') || [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://fcg-production.up.railway.app',
    'https://fundacioncarmesgoudie.vercel.app',
    'https://fcgfront.vercel.app',
  ];

  // CORS configurado con whitelist de orígenes permitidos
  app.enableCors({
    origin: allowedOrigins, // Solo orígenes permitidos
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Total-Count'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Seguridad: Guards globales - TODOS los endpoints requieren autenticación por defecto
  const reflector = app.get(Reflector);
  app.useGlobalGuards(
    new JwtAuthGuard(
      app.get(JwtService),
      app.get(ConfigService),
      reflector,
    ),
    new RolesGuard(reflector),
  );

  // Prefijo global
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`🚀 Application is running on: http://localhost:${port}/api`);
  console.log(`✅ CORS enabled for: ${allowedOrigins.join(', ')}`);
  console.log(`🔒 Security: Helmet + HPP + Rate Limiting enabled`);
  console.log(`🛡️  Guards: JWT Auth + Roles globally enforced`);
  console.log(`🔐 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
}
bootstrap();
