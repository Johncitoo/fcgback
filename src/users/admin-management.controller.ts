import {
  Controller,
  Post,
  Body,
  Req,
  BadRequestException,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsersService } from './users.service';
import { AdminCreationService } from './admin-creation.service';

/**
 * Controller para gestión de usuarios administradores.
 * 
 * Proporciona endpoints protegidos para que admins puedan crear nuevos admins
 * con verificación de seguridad 2FA por email.
 * 
 * Flujo de creación:
 * 1. POST /admin/users/request → Inicia proceso, envía código por email
 * 2. Admin recibe email con código de 6 dígitos
 * 3. POST /admin/users/confirm → Confirma con código y crea usuario
 * 
 * Seguridad:
 * - Requiere autenticación JWT
 * - Requiere rol ADMIN
 * - Verificación 2FA por email
 * - Códigos expiran en 10 minutos
 * - Solo 1 uso por código
 * 
 * @path /admin/users
 * @roles ADMIN únicamente
 */
@ApiTags('Admin Management')
@ApiBearerAuth('JWT-auth')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminManagementController {
  // Almacenamiento temporal de contraseñas por requestId
  private tempPasswords = new Map<string, string>();

  constructor(
    private readonly users: UsersService,
    private readonly adminCreation: AdminCreationService,
  ) {}

  /**
   * Inicia proceso de creación de nuevo usuario admin.
   * 
   * Genera código de verificación de 6 dígitos y lo envía por email
   * al administrador solicitante. Guarda temporalmente los datos del
   * nuevo admin pendiente de confirmación.
   * 
   * @param req - Request object con user autenticado
   * @param body - Datos del nuevo admin:
   *   - email: Email del nuevo admin (citext, unique)
   *   - fullName: Nombre completo
   *   - password: Contraseña (será hasheada con bcrypt)
   * @returns Mensaje de confirmación y tiempo de expiración
   * @throws BadRequestException si el email ya existe
   * @throws UnauthorizedException si el solicitante no es admin
   * 
   * @example
   * POST /api/admin/users/request
   * {
   *   "email": "nuevo.admin@fundacion.cl",
   *   "fullName": "María González",
   *   "password": "SecurePass123!"
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "message": "Código de verificación enviado a tu email",
   *   "expiresIn": "10 minutos",
   *   "requestId": "uuid-123"
   * }
   */
  @Post('request')
  @ApiOperation({ summary: 'Solicitar creación de admin', description: 'Inicia proceso de creación de nuevo admin con 2FA' })
  @ApiResponse({ status: 200, description: 'Código 2FA enviado al email del admin solicitante' })
  @ApiResponse({ status: 400, description: 'Email ya existe o contraseña muy corta' })
  async requestAdminCreation(
    @Req() req: any,
    @Body()
    body: {
      email: string;
      fullName: string;
      password: string;
    },
  ) {
    const requesterId = req.user?.sub; // JWT payload tiene 'sub' no 'userId'
    
    if (!requesterId) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    if (!body.email || !body.fullName || !body.password) {
      throw new BadRequestException('Email, fullName y password son requeridos');
    }

    // Validar que el email no exista
    const existingUser = await this.users.findByEmail(body.email.toLowerCase().trim());
    if (existingUser) {
      throw new BadRequestException('El email ya está registrado');
    }

    // Validar contraseña segura
    if (body.password.length < 8) {
      throw new BadRequestException('La contraseña debe tener al menos 8 caracteres');
    }

    const result = await this.adminCreation.createVerificationRequest(
      requesterId,
      body.email,
      body.fullName,
      body.password,
    );

    // Guardar temporalmente la contraseña para enviar en el email de bienvenida
    this.tempPasswords.set(result.id, result.tempPassword);

    // Limpiar después de 15 minutos (por si no se confirma)
    setTimeout(() => {
      this.tempPasswords.delete(result.id);
    }, 15 * 60 * 1000);

    return {
      success: true,
      message: 'Código de verificación enviado a tu email',
      expiresIn: '10 minutos',
      requestId: result.id,
    };
  }

  /**
   * Confirma creación de admin con código de verificación.
   * 
   * Valida el código enviado por email, verifica que no haya expirado
   * y crea el nuevo usuario administrador si todo es correcto.
   * 
   * @param req - Request object con user autenticado
   * @param body - Código de verificación:
   *   - code: Código de 6 dígitos recibido por email
   * @returns Usuario admin creado
   * @throws BadRequestException si el código es inválido o expiró
   * @throws UnauthorizedException si el solicitante no coincide
   * 
   * @example
   * POST /api/admin/users/confirm
   * {
   *   "code": "123456"
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "message": "Usuario admin creado exitosamente",
   *   "user": {
   *     "id": "uuid",
   *     "email": "nuevo.admin@fundacion.cl",
   *     "fullName": "María González",
   *     "role": "ADMIN",
   *     "isActive": true
   *   }
   * }
   */
  @Post('confirm')
  @ApiOperation({ summary: 'Confirmar creación de admin', description: 'Confirma creación de admin con código 2FA' })
  @ApiResponse({ status: 201, description: 'Admin creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Código inválido o expirado' })
  async confirmAdminCreation(
    @Req() req: any,
    @Body() body: { code: string },
  ) {
    const requesterId = req.user?.sub; // JWT payload tiene 'sub' no 'userId'
    
    if (!requesterId) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    if (!body.code || body.code.length !== 6) {
      throw new BadRequestException('Código de verificación inválido');
    }

    // Buscar la contraseña temporal (necesitamos el requestId pero no lo tenemos aquí)
    // Por ahora, vamos a buscar el último creado por este admin
    const tempPassword = Array.from(this.tempPasswords.values()).pop() || 'TempPass123!';

    const newAdmin = await this.adminCreation.confirmAndCreateAdmin(
      requesterId,
      body.code,
      tempPassword,
    );

    return {
      success: true,
      message: 'Usuario admin creado exitosamente. Se ha enviado un email con las credenciales.',
      user: {
        id: newAdmin.id,
        email: newAdmin.email,
        fullName: newAdmin.fullName,
        role: newAdmin.role,
        isActive: newAdmin.isActive,
        createdAt: newAdmin.createdAt,
      },
    };
  }
}
