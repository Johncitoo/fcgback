import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Controller('applicants')
export class ApplicantsController {
  constructor(
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  private getUserFromAuth(req: any) {
    const hdr = req.headers?.authorization ?? '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) throw new UnauthorizedException('Missing bearer token');

    try {
      const payload = this.jwt.verify(token, {
        secret: this.cfg.get<string>('AUTH_JWT_SECRET')!,
        ignoreExpiration: false,
      });
      return payload as { sub: string; role: string; typ: string };
    } catch (e) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * GET /applicants/me
   * Retorna información del applicant actual basado en el token JWT
   */
  @Get('me')
  async getMe(@Req() req: any) {
    const user = this.getUserFromAuth(req);
    
    if (user.role !== 'APPLICANT') {
      throw new UnauthorizedException('Applicant access required');
    }

    // Buscar el applicant_id del usuario
    const userResult = await this.dataSource.query(
      'SELECT applicant_id FROM users WHERE id = $1',
      [user.sub],
    );

    if (!userResult || userResult.length === 0 || !userResult[0].applicant_id) {
      throw new UnauthorizedException('Applicant not found');
    }

    const applicantId = userResult[0].applicant_id;

    // Obtener datos del applicant
    const applicantResult = await this.dataSource.query(
      `SELECT id, email, first_name, last_name, phone, rut_number, rut_dv, 
              birth_date, address, commune, region, institution_id
       FROM applicants 
       WHERE id = $1`,
      [applicantId],
    );

    if (!applicantResult || applicantResult.length === 0) {
      throw new UnauthorizedException('Applicant profile not found');
    }

    return applicantResult[0];
  }
}
