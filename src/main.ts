import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Seguridad: Helmet para headers seguros
  app.use(helmet());

  // CORS configurado correctamente (NO abierto completamente)
  const allowedOrigins = config.get<string>('CORS_ORIGINS')?.split(',') || [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://fcg-production.up.railway.app',
    'https://fundacion-carmen-goudie.vercel.app',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (Postman, mobile apps, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️  CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Total-Count'],
  });

  // Validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Prefijo global
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`🚀 Application is running on: http://localhost:${port}/api`);
  console.log(`✅ CORS enabled for: ${allowedOrigins.join(', ')}`);
}
bootstrap();
