import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import helmet from 'helmet';
import hpp from 'hpp';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
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

  // Seguridad: Sanitización de datos (previene NoSQL injection aunque usemos PostgreSQL)
  app.use(mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
      console.warn(`⚠️  Data sanitization triggered on ${req.path} for key: ${key}`);
    },
  }));

  // Performance: Compresión de respuestas (reduce tamaño de payloads)
  app.use(compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6, // Balance entre compresión y CPU
  }));
  
  console.log('✓ FCG Backend iniciando - v1.0.2 (CORS ABIERTO PARA TESTEO)');

  // ⚠️ CORS ABIERTO TEMPORALMENTE PARA TESTING
  // TODO: Volver a restringir antes de producción final en Namecheap
  app.enableCors({
    origin: true, // Permite CUALQUIER origen
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
  console.log(`⚠️  CORS: ABIERTO PARA TESTEO (permitiendo todos los orígenes)`);
  console.log(`🔒 Security: Helmet + HPP + Sanitization + Compression enabled`);
  console.log(`🛡️  Guards: JWT Auth + Roles + Rate Limiting globally enforced`);
  console.log(`🔐 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
}
bootstrap();
