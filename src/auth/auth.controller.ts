import { Body, Controller, Get, HttpCode, Ip, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginStaffDto } from './dto/login-staff.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';
import { ValidateInviteDto } from './dto/validate-invite.dto';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Verifica la autenticación del usuario y retorna información básica.
   * 
   * Valida el token JWT y retorna los datos del usuario autenticado.
   * Usado por el frontend para verificar validez del token.
   * 
   * @param {any} req - Objeto de request con usuario inyectado por JwtAuthGuard
   * @returns {Promise<{id: string, role: string, type: string}>} Datos del usuario autenticado
   * 
   * @throws {UnauthorizedException} Si el token es inválido o ha expirado
   * 
   * @example
   * GET /api/auth/me
   * Authorization: Bearer <token>
   * 
   * Response:
   * {
   *   "id": "user-uuid",
   *   "role": "ADMIN",
   *   "type": "access"
   * }
   */
  @Get('me')
  @HttpCode(200)
  async getMe(@Req() req: any) {
    const user = req.user; // Inyectado por JwtAuthGuard
    return {
      id: user.sub,
      role: user.role,
      type: user.typ,
    };
  }

  /**
   * Autentica usuarios de tipo staff (ADMIN o REVIEWER).
   * 
   * Valida credenciales y genera tokens JWT (access y refresh).
   * Incluye rate limiting de 5 intentos por minuto por IP.
   * Registra el intento de login en audit log.
   * 
   * @param {LoginStaffDto} dto - Credenciales (email y password)
   * @param {any} req - Objeto de request con IP y user-agent
   * @returns {Promise<{accessToken: string, refreshToken: string, user: object}>} Tokens y datos del usuario
   * 
   * @throws {UnauthorizedException} Si las credenciales son inválidas
   * @throws {ForbiddenException} Si el usuario no es ADMIN o REVIEWER
   * @throws {TooManyRequestsException} Si se excede el rate limit
   * 
   * @example
   * POST /api/auth/login-staff
   * Content-Type: application/json
   * 
   * Body:
   * {
   *   "email": "admin@fundacion.cl",
   *   "password": "SecurePassword123!"
   * }
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login-staff')
  @HttpCode(200)
  async loginStaff(@Body() dto: LoginStaffDto, @Req() req: any) {
    const ip = req.ip;
    const ua = req.headers?.['user-agent'];
    return this.auth.loginStaff(dto.email, dto.password, ip, ua);
  }

  /**
   * Renueva el access token usando un refresh token válido.
   * 
   * Permite obtener un nuevo access token sin reautenticarse.
   * El refresh token debe estar almacenado en la base de datos y no revocado.
   * 
   * @param {RefreshDto} dto - Refresh token
   * @param {string} ip - IP del cliente
   * @param {any} req - Objeto de request con user-agent
   * @returns {Promise<{accessToken: string}>} Nuevo access token
   * 
   * @throws {UnauthorizedException} Si el refresh token es inválido o revocado
   * 
   * @example
   * POST /api/auth/refresh
   * Content-Type: application/json
   * 
   * Body:
   * {
   *   "refreshToken": "<refresh-token-string>"
   * }
   */
  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto, @Ip() ip: string, @Req() req: any) {
    const ua = req?.headers?.['user-agent'] ?? undefined;
    return this.auth.refresh(dto.refreshToken, ip, ua);
  }

  /**
   * Cierra sesión revocando el refresh token.
   * 
   * Marca el refresh token como revocado en la base de datos,
   * impidiendo su uso para renovar el access token.
   * 
   * @param {LogoutDto} dto - Refresh token a revocar
   * @returns {Promise<{message: string}>} Confirmación de logout
   * 
   * @example
   * POST /api/auth/logout
   * Content-Type: application/json
   * 
   * Body:
   * {
   *   "refreshToken": "<refresh-token-string>"
   * }
   */
  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Body() dto: LogoutDto) {
    return this.auth.logout(dto.refreshToken);
  }

  // Login con código de invitación (LEGACY - se recomienda usar /onboarding/validate-invite)
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 intentos por minuto
  @Post('enter-invite')
  @HttpCode(200)
  async enterInvite(@Body() dto: ValidateInviteDto, @Req() req: any) {
    const ip = req.ip;
    const ua = req.headers?.['user-agent'];
    return this.auth.validateInviteCode(dto.code, dto.email, ip, ua);
  }

  /**
   * Autentica usuarios de tipo postulante (APPLICANT).
   * 
   * Valida credenciales y genera tokens JWT (access y refresh).
   * Incluye rate limiting de 5 intentos por minuto por IP.
   * 
   * @param {object} dto - Credenciales (email y password)
   * @param {string} dto.email - Email del postulante
   * @param {string} dto.password - Contraseña
   * @param {any} req - Objeto de request con IP y user-agent
   * @returns {Promise<{accessToken: string, refreshToken: string, user: object}>} Tokens y datos del usuario
   * 
   * @throws {UnauthorizedException} Si las credenciales son inválidas
   * @throws {ForbiddenException} Si el usuario no es APPLICANT
   * @throws {TooManyRequestsException} Si se excede el rate limit
   * 
   * @example
   * POST /api/auth/login
   * Content-Type: application/json
   * 
   * Body:
   * {
   *   "email": "postulante@email.com",
   *   "password": "MiPassword123!"
   * }
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(200)
  async loginApplicant(
    @Body() dto: { email: string; password: string },
    @Req() req: any,
  ) {
    const ip = req.ip;
    const ua = req.headers?.['user-agent'];
    return this.auth.loginApplicant(dto.email, dto.password, ip, ua);
  }

  /**
   * Inicia el proceso de recuperación de contraseña.
   * 
   * Genera un token de reseteo y envía un email con enlace de recuperación.
   * El token expira en 24 horas y es de un solo uso.
   * Incluye rate limiting de 3 intentos por minuto.
   * 
   * @param {object} dto - Email del usuario
   * @param {string} dto.email - Dirección de email registrada
   * @returns {Promise<{message: string}>} Confirmación de envío de email
   * 
   * @throws {TooManyRequestsException} Si se excede el rate limit
   * 
   * @example
   * POST /api/auth/forgot-password
   * Content-Type: application/json
   * 
   * Body:
   * {
   *   "email": "usuario@email.com"
   * }
   */
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: { email: string }) {
    return this.auth.forgotPassword(dto.email);
  }

  /**
   * Valida un token de reseteo de contraseña sin consumirlo.
   * 
   * Verifica que el token sea válido, no haya expirado y no haya sido usado.
   * Usado por el frontend para validar el enlace antes de mostrar el formulario.
   * 
   * @param {object} dto - Token de reseteo
   * @param {string} dto.token - Token recibido por email
   * @returns {Promise<{valid: boolean, email?: string}>} Estado de validez del token
   * 
   * @throws {BadRequestException} Si el token es inválido, usado o expirado
   * 
   * @example
   * POST /api/auth/validate-reset-token
   * Content-Type: application/json
   * 
   * Body:
   * {
   *   "token": "reset-token-string"
   * }
   */
  @Public()
  @Post('validate-reset-token')
  @HttpCode(200)
  async validateResetToken(@Body() dto: { token: string }) {
    return this.auth.validateResetToken(dto.token);
  }

  /**
   * Restablece la contraseña usando un token válido.
   * 
   * Valida el token, actualiza la contraseña y marca el token como usado.
   * La nueva contraseña debe cumplir requisitos de seguridad.
   * 
   * @param {object} dto - Token y nueva contraseña
   * @param {string} dto.token - Token de reseteo
   * @param {string} dto.newPassword - Nueva contraseña (mín 8 caracteres, mayúsculas, números)
   * @returns {Promise<{message: string}>} Confirmación de cambio de contraseña
   * 
   * @throws {BadRequestException} Si el token es inválido o la contraseña no cumple requisitos
   * @throws {UnauthorizedException} Si el token ha expirado o ya fue usado
   * 
   * @example
   * POST /api/auth/reset-password
   * Content-Type: application/json
   * 
   * Body:
   * {
   *   "token": "reset-token-string",
   *   "newPassword": "NuevaPassword123!"
   * }
   */
  @Public()
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: { token: string; newPassword: string }) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }

  /**
   * Crea usuarios staff para desarrollo (SOLO DESARROLLO).
   * 
   * Endpoint protegido por variable de entorno NODE_ENV.
   * No debe estar disponible en producción.
   * 
   * @param {object} body - Datos del usuario a crear
   * @param {string} body.email - Email del usuario
   * @param {string} body.fullName - Nombre completo
   * @param {'ADMIN' | 'REVIEWER'} body.role - Rol del usuario
   * @param {string} body.password - Contraseña
   * @returns {Promise<{user: object}>} Usuario creado
   * 
   * @throws {ForbiddenException} Si NODE_ENV es 'production'
   * @throws {BadRequestException} Si el email ya existe
   * 
   * @example
   * POST /api/auth/dev/seed-staff
   * Content-Type: application/json
   * 
   * Body:
   * {
   *   "email": "admin@test.com",
   *   "fullName": "Admin Test",
   *   "role": "ADMIN",
   *   "password": "DevPassword123!"
   * }
   */
  @Public()
  @Post('dev/seed-staff')
  @HttpCode(200)
  devSeed(
    @Body()
    body: {
      email: string;
      fullName: string;
      role: 'ADMIN' | 'REVIEWER';
      password: string;
    },
  ) {
    return this.auth.devSeedStaff(
      body.email,
      body.fullName,
      body.role,
      body.password,
    );
  }
}
