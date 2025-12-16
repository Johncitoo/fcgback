import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ProfileService } from './profile.service';
import { Roles } from '../auth/roles.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('profile') // <-- sin /api
@Roles('APPLICANT')
export class ProfileController {
  constructor(
    private jwt: JwtService,
    private cfg: ConfigService,
    private prof: ProfileService,
  ) {}

  /**
   * Extrae y valida el usuario desde el token JWT en el header Authorization.
   * 
   * @param req - Objeto Request con headers de autenticación
   * @returns Payload del JWT con sub (user ID), role y typ (tipo de token)
   * @throws {Error} Si el token no está presente o es inválido
   * 
   * @example
   * const user = this.getUserFromAuth(req);
   * // { sub: 'uuid-123', role: 'APPLICANT', typ: 'access' }
   */
  private getUserFromAuth(req: any) {
    const hdr = req.headers?.authorization ?? '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) throw new Error('Missing bearer token');

    try {
      const payload = this.jwt.verify(token, {
        secret: this.cfg.get<string>('AUTH_JWT_SECRET')!,
        ignoreExpiration: false,
      });
      return payload as { sub: string; role: string; typ: string };
    } catch (e) {
      console.error('JWT verification failed:', e.message);
      throw new Error('Invalid token');
    }
  }

  /**
   * Asegura que el usuario tenga un perfil de applicant creado o lo actualiza.
   * Crea o actualiza el registro en la tabla applicants vinculado al usuario.
   * 
   * @param req - Request con token JWT del postulante
   * @param body - Datos del perfil de applicant (RUT, nombre, dirección, etc.)
   * @returns Perfil de applicant creado o actualizado
   * @throws {BadRequestException} Si el token no es de APPLICANT
   * 
   * @example
   * POST /api/profile/applicant
   * Body: { "data": { "first_name": "Juan", "last_name": "Pérez", "rut": "12345678-9" } }
   */
  @Post('applicant')
  async ensureApplicant(@Req() req: any, @Body() body: UpdateProfileDto) {
    const user = this.getUserFromAuth(req);
    if (user.typ !== 'access' || user.role !== 'APPLICANT') {
      throw new BadRequestException('Applicant access token required');
    }
    return this.prof.ensureApplicant(user.sub, body.data || body);
  }
}
