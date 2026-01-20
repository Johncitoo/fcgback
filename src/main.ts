import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import hpp from 'hpp';
import compression from 'compression';
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
  
  console.log('✓ FCG Backend iniciando - v1.0.3 (Producción Namecheap)');

  // CORS configurado para producción (Namecheap/cPanel)
  app.enableCors({
    origin: [
      'https://postulaciones.fundacioncarmengoudie.cl',
      'https://fundacioncarmengoudie.cl',
      'https://www.fundacioncarmengoudie.cl',
      // Desarrollo local
      'http://localhost:5173',
      'http://localhost:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'Cache-Control', 'Pragma'],
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

  // ========================================
  // Swagger API Documentation
  // ========================================
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Fundación Carmes Goudie API')
    .setDescription(`
## API del Sistema de Gestión de Becas

Esta API permite gestionar el proceso completo de postulación a becas:

### Módulos Principales
- **Auth**: Autenticación JWT, refresh tokens, 2FA
- **Onboarding**: Registro de postulantes con códigos de invitación
- **Applications**: Gestión de postulaciones
- **Calls**: Convocatorias de becas
- **Forms**: Formularios dinámicos
- **Selection**: Proceso de selección final
- **Documents**: Gestión de documentos

### Autenticación
Todos los endpoints (excepto los públicos) requieren JWT Bearer token.
    `)
    .setVersion('1.0.3')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Ingresa tu JWT token',
      },
      'JWT-auth',
    )
    .addTag('Auth', 'Autenticación y gestión de sesiones')
    .addTag('Onboarding', 'Registro de postulantes e invitaciones')
    .addTag('Invites', 'Gestión de invitaciones')
    .addTag('Applications', 'Gestión de postulaciones')
    .addTag('Calls', 'Convocatorias de becas')
    .addTag('Forms', 'Formularios dinámicos')
    .addTag('Form Submissions', 'Respuestas de formularios')
    .addTag('Selection', 'Proceso de selección')
    .addTag('Applicants', 'Gestión de postulantes')
    .addTag('Profile', 'Perfil de postulantes')
    .addTag('Admin Users', 'Gestión de usuarios admin/reviewer')
    .addTag('Admin Applicants', 'Gestión admin de applicants')
    .addTag('Admin Management', 'Creación de admins con 2FA')
    .addTag('Reviewer Management', 'Creación de reviewers con 2FA')
    .addTag('User Auth', 'Cambio de contraseña de usuarios')
    .addTag('Password Change', 'Cambio de contraseña por email')
    .addTag('Milestones', 'Hitos del proceso')
    .addTag('Files', 'Gestión de archivos y almacenamiento')
    .addTag('Support Messages', 'Mensajes de soporte autenticados')
    .addTag('Public Contact', 'Contacto público sin autenticación')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'FCG API Documentation',
  });

  // Puerto: cPanel/Passenger inyecta process.env.PORT
  const port = parseInt(process.env.PORT ?? '3000', 10);
  
  // Escuchar en 0.0.0.0 para que cPanel/Passenger pueda conectar
  await app.listen(port, '0.0.0.0');
  
  console.log(`🚀 Application is running on: http://0.0.0.0:${port}/api`);
  console.log(`📚 API Docs available at: http://localhost:${port}/api/docs`);
  console.log(`🌐 CORS: Configurado para producción (postulaciones.fundacioncarmengoudie.cl)`);
  console.log(`🔒 Security: Helmet + HPP + Compression enabled`);
  console.log(`🛡️  Guards: JWT Auth + Roles + Rate Limiting globally enforced`);
  console.log(`🔐 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`✅ Input validation: class-validator en todos los DTOs`);
}
bootstrap();
