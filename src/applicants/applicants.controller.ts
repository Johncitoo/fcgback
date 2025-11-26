import { 
  Controller, 
  Get, 
  Req, 
  UnauthorizedException,
  Logger 
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Controller('applicants')
export class ApplicantsController {
  private readonly logger = new Logger(ApplicantsController.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  private getUserFromAuth(req: any) {
    const hdr = req.headers?.authorization ?? '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) {
      this.logger.warn('No bearer token provided');
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const secret = this.cfg.get<string>('AUTH_JWT_SECRET');
      if (!secret) {
        this.logger.error('AUTH_JWT_SECRET not configured');
        throw new Error('JWT secret not configured');
      }

      const payload = this.jwt.verify(token, {
        secret,
        ignoreExpiration: false,
      });
      return payload as { sub: string; role: string; typ: string };
    } catch (e: any) {
      this.logger.error(`JWT verification failed: ${e.message}`);
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * GET /applicants/me
   * Retorna información del applicant actual basado en el token JWT
   */
  @Get('me')
  async getMe(@Req() req: any) {
    try {
      this.logger.log('GET /applicants/me - Iniciando...');
      
      const user = this.getUserFromAuth(req);
      this.logger.log(`Usuario autenticado: ${user.sub}, role: ${user.role}`);
      
      if (user.role !== 'APPLICANT') {
        this.logger.warn(`Usuario no es APPLICANT: ${user.role}`);
        throw new UnauthorizedException('Applicant access required');
      }

      // Buscar el applicant_id del usuario
      this.logger.log(`Buscando applicant_id para user: ${user.sub}`);
      const userResult = await this.dataSource.query(
        'SELECT applicant_id FROM users WHERE id = $1',
        [user.sub],
      );

      if (!userResult || userResult.length === 0 || !userResult[0].applicant_id) {
        this.logger.error(`No se encontró applicant_id para user: ${user.sub}`);
        throw new UnauthorizedException('Applicant not found');
      }

      const applicantId = userResult[0].applicant_id;
      this.logger.log(`applicant_id encontrado: ${applicantId}`);

      // Obtener datos del applicant
      const applicantResult = await this.dataSource.query(
        `SELECT id, email, first_name, last_name, phone, rut_number, rut_dv, 
                birth_date, address, commune, region, institution_id
         FROM applicants 
         WHERE id = $1`,
        [applicantId],
      );

      if (!applicantResult || applicantResult.length === 0) {
        this.logger.error(`No se encontró applicant con id: ${applicantId}`);
        throw new UnauthorizedException('Applicant profile not found');
      }

      this.logger.log('✅ Applicant encontrado, retornando datos');
      return applicantResult[0];
    } catch (error: any) {
      this.logger.error(`Error en GET /applicants/me: ${error.message}`, error.stack);
      throw error;
    }
  }
}
