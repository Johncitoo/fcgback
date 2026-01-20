import {
  Body,
  Controller,
  Ip,
  Post,
  Req,
  UsePipes,
  ValidationPipe,
  HttpCode,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { DevCreateInviteDto } from './dto/dev-create-invite.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { ValidateInvitePublicDto } from './dto/validate-invite-public.dto';
import { Public } from '../auth/public.decorator';

/**
 * Controller para el proceso de onboarding de postulantes.
 * 
 * Gestiona la validación de códigos de invitación, creación de usuarios
 * y establecimiento de contraseñas para nuevos postulantes.
 * 
 * Flujo principal:
 * 1. Postulante recibe código de invitación por email
 * 2. POST /validate-invite valida código y crea usuario
 * 3. POST /set-password establece contraseña
 * 4. Usuario puede hacer login normal
 */
@ApiTags('Onboarding')
@Controller('onboarding')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  /**
   * Valida un código de invitación y genera token para establecer contraseña.
   * Endpoint público con rate limiting (5 intentos por minuto).
   * 
   * @param dto - Código de invitación y email opcional
   * @returns Información del usuario y token para establecer contraseña (válido 10 min)
   * @throws {BadRequestException} Si el código es inválido o expiró
   * 
   * @example
   * POST /api/onboarding/validate-invite
   * Body: { "code": "ABC123", "email": "user@example.com" }
   * Response: { "success": true, "passwordToken": "token123", "userId": "uuid" }
   */
  @Public()
  @Post('validate-invite')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Validar código de invitación', description: 'Valida código y genera token para establecer contraseña' })
  @ApiResponse({ status: 200, description: 'Código válido, token generado' })
  @ApiResponse({ status: 400, description: 'Código inválido o expirado' })
  @ApiResponse({ status: 429, description: 'Demasiados intentos' })
  async validateInvite(@Body() dto: ValidateInvitePublicDto) {
    const result = await this.onboarding.validateInviteCode(dto.code, dto.email || '');
    
    return {
      success: true,
      email: result.user.email,
      passwordToken: result.passwordToken, // Devolver token para setear contraseña inmediatamente
      tokenExpiresIn: 600, // 10 minutos en segundos
      message: result.isNewUser 
        ? 'Código validado exitosamente. Ahora crea tu contraseña para acceder.'
        : 'Bienvenido de vuelta. Ahora crea tu contraseña para acceder.',
      applicationId: result.applicationId,
      userId: result.user.id,
      userName: result.user.fullName,
    };
  }

  /**
   * Establece la contraseña del usuario usando el token de invitación.
   * Endpoint público. Token válido por 10 minutos.
   * 
   * @param dto - Token de invitación y nueva contraseña
   * @param req - Request para obtener user agent
   * @param ip - IP del cliente
   * @returns Confirmación y userId
   * @throws {BadRequestException} Si el token es inválido o expiró
   * 
   * @example
   * POST /api/onboarding/set-password
   * Body: { "token": "token123", "password": "SecurePass123!" }
   */
  @Public()
  @Post('set-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Establecer contraseña', description: 'Establece la contraseña usando token de invitación' })
  @ApiResponse({ status: 200, description: 'Contraseña establecida' })
  @ApiResponse({ status: 400, description: 'Token inválido o expirado' })
  async setPassword(
    @Body() dto: SetPasswordDto,
    @Req() req: any,
    @Ip() ip: string,
  ) {
    const ua = req?.headers?.['user-agent'] as string | undefined;
    const user = await this.onboarding.setPasswordWithToken(
      dto.token,
      dto.password,
      ip,
      ua,
    );
    return { 
      success: true, 
      userId: user.id,
      message: 'Contraseña establecida exitosamente. Ahora puedes iniciar sesión.',
    };
  }

  /**
   * Crea un código de invitación para desarrollo.
   * 
   * Endpoint de desarrollo para generar códigos de invitación sin restricciones.
   * Permite especificar el código exacto, TTL y vincular a institución.
   * 
   * @param dto - CallId, código personalizado, TTL en días e institutionId opcional
   * @param dto.callId - UUID de la convocatoria
   * @param dto.code - Código alfanumérico personalizado (ej: TEST123)
   * @param dto.ttlDays - Días de validez del código (default: 30)
   * @param dto.institutionId - UUID de institución educativa (opcional)
   * @returns Código de invitación creado con expires_at calculado
   * @throws {BadRequestException} Si el código ya existe o callId es inválido
   * 
   * @public Solo para desarrollo/testing, no usar en producción
   * 
   * @example
   * POST /api/onboarding/dev/create-invite
   * Body: { "callId": "uuid-123", "code": "LICEO-A1-2024", "ttlDays": 60, "institutionId": "uuid-456" }
   * Response: { "id": "uuid-789", "code": "LICEO-A1-2024", "expires_at": "2024-12-31T23:59:59Z" }
   */
  @Public()
  @Post('dev/create-invite')
  @ApiOperation({ summary: '[DEV] Crear invitación', description: 'Crea código de invitación (solo desarrollo)', deprecated: true })
  @ApiResponse({ status: 200, description: 'Invitación creada' })
  async devCreateInvite(
    @Body() dto: DevCreateInviteDto,
  ) {
    return this.onboarding.devCreateInvite(
      dto.callId,
      dto.code,
      dto.ttlDays,
      dto.institutionId,
    );
  }

  /**
   * Establece contraseña directamente por email sin token.
   * 
   * Endpoint de desarrollo que bypasea el flujo normal de onboarding.
   * Permite establecer contraseña sin validar código de invitación.
   * Registra la sesión con IP y user-agent para auditoría.
   * 
   * @param body - Email y nueva contraseña
   * @param body.email - Email del usuario registrado
   * @param body.password - Contraseña (debe cumplir requisitos: 8+ caracteres, mayúsculas, números)
   * @param req - Request para extraer user-agent del header
   * @param ip - IP del cliente (decorador @Ip())
   * @returns Confirmación con userId para referencia
   * @throws {NotFoundException} Si el email no existe en la BD
   * @throws {BadRequestException} Si la contraseña no cumple requisitos de seguridad
   * 
   * @public Solo para desarrollo/testing, no usar en producción
   * 
   * @example
   * POST /api/onboarding/dev/set-password
   * Body: { "email": "test@example.com", "password": "SecurePass123!" }
   * Response: { "success": true, "userId": "uuid-123", "message": "Contraseña establecida exitosamente..." }
   */
  @Public()
  @Post('dev/set-password')
  @HttpCode(200)
  async devSetPassword(
    @Body() body: { email: string; password: string },
    @Req() req: any,
    @Ip() ip: string,
  ) {
    const ua = req?.headers?.['user-agent'] as string | undefined;
    const user = await this.onboarding.devSetPasswordByEmail(
      body.email,
      body.password,
      ip,
      ua,
    );
    return { 
      success: true, 
      userId: user.id,
      message: 'Contraseña establecida exitosamente. Ahora puedes iniciar sesión.',
    };
  }
}
