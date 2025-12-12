import { 
  Controller, 
  Get, 
  Delete,
  Param,
  Req, 
  UnauthorizedException,
  Logger 
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Roles } from '../auth/roles.decorator';

@Controller('applicants')
@Roles('ADMIN', 'REVIEWER')
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
  @Roles('APPLICANT')
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

  /**
   * Endpoint de administración para eliminar TODOS los datos de un postulante por email
   * Solo para testing/desarrollo
   */
  @Delete('delete-by-email/:email')
  @Roles('ADMIN')
  async deleteApplicantByEmail(@Param('email') email: string, @Req() req: any) {
    this.logger.log(`🗑️ Eliminando todos los datos del email: ${email}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Buscar user y applicant
      const userResult = await queryRunner.query(
        `SELECT id, applicant_id FROM users WHERE email = $1 AND role = 'APPLICANT'`,
        [email]
      );

      if (!userResult || userResult.length === 0) {
        await queryRunner.rollbackTransaction();
        return { message: 'No se encontró usuario con ese email', deleted: false };
      }

      const userId = userResult[0].id;
      const applicantId = userResult[0].applicant_id;

      this.logger.log(`Usuario encontrado: ${userId}, Applicant: ${applicantId}`);

      // 2. Eliminar form_submissions
      const submissionsResult = await queryRunner.query(
        `DELETE FROM form_submissions 
         WHERE application_id IN (SELECT id FROM applications WHERE applicant_id = $1)`,
        [applicantId]
      );
      this.logger.log(`✅ form_submissions eliminadas: ${submissionsResult[1]}`);

      // 3. Eliminar milestone_progress
      const progressResult = await queryRunner.query(
        `DELETE FROM milestone_progress 
         WHERE application_id IN (SELECT id FROM applications WHERE applicant_id = $1)`,
        [applicantId]
      );
      this.logger.log(`✅ milestone_progress eliminado: ${progressResult[1]}`);

      // 4. Eliminar applications
      const appsResult = await queryRunner.query(
        `DELETE FROM applications WHERE applicant_id = $1`,
        [applicantId]
      );
      this.logger.log(`✅ applications eliminadas: ${appsResult[1]}`);

      // 5. Eliminar invites
      const invitesResult = await queryRunner.query(
        `DELETE FROM invites 
         WHERE meta->>'email' = $1 OR meta->>'testEmail' = $1`,
        [email]
      );
      this.logger.log(`✅ invites eliminadas: ${invitesResult[1]}`);

      // 6. Eliminar sessions (si existe la tabla)
      let sessionsDeleted = 0;
      try {
        const sessionsResult = await queryRunner.query(
          `DELETE FROM sessions WHERE user_id = $1`,
          [userId]
        );
        sessionsDeleted = sessionsResult[1];
        this.logger.log(`✅ sessions eliminadas: ${sessionsDeleted}`);
      } catch (err: any) {
        if (err.code === '42P01') {
          this.logger.warn(`⚠️ Tabla sessions no existe, saltando...`);
        } else {
          throw err;
        }
      }

      // 7. Eliminar user
      await queryRunner.query(`DELETE FROM users WHERE id = $1`, [userId]);
      this.logger.log(`✅ user eliminado`);

      // 8. Eliminar applicant
      await queryRunner.query(`DELETE FROM applicants WHERE id = $1`, [applicantId]);
      this.logger.log(`✅ applicant eliminado`);

      await queryRunner.commitTransaction();

      return {
        message: `Todos los datos de ${email} han sido eliminados`,
        deleted: true,
        summary: {
          userId,
          applicantId,
          formSubmissions: submissionsResult[1],
          milestoneProgress: progressResult[1],
          applications: appsResult[1],
          invites: invitesResult[1],
          sessions: sessionsDeleted
        }
      };
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error eliminando datos: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
