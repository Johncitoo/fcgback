import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Invite } from '../invites/invite.entity';
import { PasswordSetToken } from './entities/password-set-token.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { AuditService } from '../common/audit.service';
import { randomBytes } from 'crypto';
import { hash, verify } from 'argon2';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    @InjectRepository(Invite)
    private readonly inviteRepo: Repository<Invite>,
    @InjectRepository(PasswordSetToken)
    private readonly tokenRepo: Repository<PasswordSetToken>,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Busca una invitación por su código
   */
  async findInviteByCode(code: string): Promise<Invite | null> {
    const normalizedCode = code.trim().toUpperCase();
    
    // Obtener todas las invitaciones no usadas
    const invites = await this.inviteRepo.find({
      where: { usedAt: null as any },
    });
    
    // Buscar la invitación cuyo hash coincida
    for (const invite of invites) {
      try {
        if (await verify(invite.codeHash, normalizedCode)) {
          return invite;
        }
      } catch {
        // Si falla la verificación, continuar con el siguiente
        continue;
      }
    }
    
    return null;
  }

  /**
   * Crea una invitación (para desarrollo)
   */
  async devCreateInvite(
    callId: string,
    code: string,
    ttlDays?: number,
    institutionId?: string,
  ): Promise<Invite> {
    const codeHash = await hash(code.toUpperCase());
    
    const ttl = ttlDays || 30;
    const expiresAt = new Date(Date.now() + ttl * 24 * 60 * 60 * 1000);

    const invite = this.inviteRepo.create({
      callId,
      codeHash,
      expiresAt,
      institutionId: institutionId || null,
      usedByApplicant: null,
      usedAt: null,
      meta: null,
      createdByUserId: null,
    });

    return this.inviteRepo.save(invite);
  }

  /**
   * Valida un código de invitación y crea/actualiza usuario + applicant + application
   * NUEVA LÓGICA: NO quema el código hasta completar el formulario
   */
  async validateInviteCode(
    code: string,
    email: string,
  ): Promise<{ 
    user: User; 
    invite: Invite; 
    applicationId: string;
    passwordToken: string;
    isNewUser: boolean;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const invite = await this.findInviteByCode(code);

      if (!invite) {
        throw new NotFoundException('Código de invitación no encontrado');
      }

      // Verificar expiración
      if (invite.expiresAt && invite.expiresAt < new Date()) {
        throw new BadRequestException('El código ha expirado');
      }

      // NUEVO: Verificar que el código NO haya sido usado
      if (invite.usedAt || invite.usedByApplicant) {
        throw new BadRequestException('Este código ya ha sido utilizado. Si necesitas acceso nuevamente, contacta con el administrador para obtener un nuevo código.');
      }
      
      // Si el email viene vacío o es temporal, intentar obtenerlo del meta del invite
      let finalEmail = email;
      if (!email || email === 'temp@placeholder.com' || email.includes('@pending.local')) {
        const metaEmail = invite.meta?.testEmail || invite.meta?.email;
        if (metaEmail) {
          finalEmail = metaEmail;
          this.logger.log(`Email obtenido del meta del invite: ${finalEmail}`);
        } else if (!email) {
          throw new BadRequestException('El código no tiene email asociado. Por favor proporciona tu email.');
        }
      }

      // Verificar si ya existe usuario con este email (puede ser de código anterior)
      const existingUserCheck = await queryRunner.manager.query(
        'SELECT u.id, u.applicant_id, a.id as applicant_exists FROM users u LEFT JOIN applicants a ON a.id = u.applicant_id WHERE u.email = $1 AND u.role = $2',
        [finalEmail, 'APPLICANT'],
      );

      let applicantId: string;
      let user: User;
      let isNewUser = false;

      if (existingUserCheck && existingUserCheck.length > 0) {
        // Usuario ya existe - reutilizar
        const existingUser = existingUserCheck[0];
        user = existingUser;
        applicantId = existingUser.applicant_id;
        
        if (!applicantId || !existingUser.applicant_exists) {
          throw new BadRequestException('Usuario existe pero no tiene applicant asociado. Contacta soporte.');
        }

        this.logger.log(`Reutilizando usuario existente: ${user.id}, applicant: ${applicantId}`);
      } else {
        // Crear nuevo applicant y usuario
        isNewUser = true;

        // Generar RUT temporal único usando timestamp + random
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.floor(Math.random() * 1000);
        const tempRut = parseInt(timestamp + random.toString().padStart(3, '0').slice(-3));
        const dv = this.calculateRutDV(tempRut);

        // Verificar que no exista este RUT
        const existingRut = await queryRunner.manager.query(
          'SELECT id FROM applicants WHERE rut_number = $1 AND rut_dv = $2',
          [tempRut, dv],
        );

        if (existingRut && existingRut.length > 0) {
          throw new ConflictException('Error al generar RUT temporal, intenta nuevamente');
        }

        const applicantResult = await queryRunner.manager.query(
          `INSERT INTO applicants (rut_number, rut_dv, first_name, last_name, email)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [tempRut, dv, 'Postulante', 'Pendiente', finalEmail],
        );

        applicantId = applicantResult[0].id;

        // Crear usuario con email real
        const tempPassword = randomBytes(32).toString('hex');
        const passwordHash = await hash(tempPassword);

        const userResult = await queryRunner.manager.query(
          `INSERT INTO users (email, full_name, password_hash, role, is_active, applicant_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [finalEmail, `Postulante ${code}`, passwordHash, 'APPLICANT', true, applicantId],
        );

        user = userResult[0];
        this.logger.log(`Nuevo usuario creado: ${user.id} para applicant: ${applicantId}`);
      }

      // Vincular invitación con applicant y marcar como usado
      // (el constraint requiere que both used_by_applicant y used_at sean NULL o ambos tengan valor)
      await queryRunner.manager.query(
        'UPDATE invites SET used_by_applicant = $1, used_at = NOW() WHERE id = $2',
        [applicantId, invite.id],
      );

      // Crear application en DRAFT
      const appResult = await queryRunner.manager.query(
        `INSERT INTO applications (applicant_id, call_id, status)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [applicantId, invite.callId, 'DRAFT'],
      );
      const applicationId = appResult[0].id;
      this.logger.log(`Nueva application creada: ${applicationId}`);

      // Generar token para establecer contraseña
      const token = randomBytes(32).toString('hex');
      const tokenHash = await hash(token);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await queryRunner.manager.query(
        `INSERT INTO password_set_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, tokenHash, expiresAt],
      );

      await queryRunner.commitTransaction();

      // Auditoría
      this.auditService
        .logInviteValidation(invite.id, applicantId, isNewUser)
        .catch((err) => this.logger.error(`Error en auditoría: ${err}`));

      // Enviar email con token (no bloqueante)
      this.emailService
        .sendPasswordSetEmail(finalEmail, token, user.fullName)
        .catch((err) => this.logger.error(`Error enviando email: ${err}`));

      return { 
        user, 
        invite, 
        applicationId, 
        passwordToken: token,
        isNewUser,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Crea un token para establecer contraseña
   */
  async issuePasswordSetToken(
    userId: string,
    ip?: string,
    ua?: string,
  ): Promise<{ token: string; tokenEntity: PasswordSetToken }> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = await hash(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    const passwordToken = this.tokenRepo.create({
      userId,
      tokenHash,
      expiresAt,
      usedAt: null,
      issuedIp: ip || null,
      issuedUserAgent: ua || null,
      consumedIp: null,
      consumedUserAgent: null,
    });

    const saved = await this.tokenRepo.save(passwordToken);
    return { token, tokenEntity: saved };
  }

  /**
   * Valida un token de establecimiento de contraseña
   */
  async validatePasswordToken(token: string): Promise<PasswordSetToken> {
    const allTokens = await this.tokenRepo
      .createQueryBuilder('token')
      .where('token.usedAt IS NULL')
      .andWhere('token.expiresAt > :now', { now: new Date() })
      .leftJoinAndSelect('token.user', 'user')
      .getMany();

    // Verificar cada token con argon2
    let passwordToken: PasswordSetToken | null = null;

    for (const t of allTokens) {
      try {
        const isValid = await verify(t.tokenHash, token);
        if (isValid) {
          passwordToken = t;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!passwordToken) {
      throw new NotFoundException('Token no encontrado o expirado');
    }

    return passwordToken;
  }

  /**
   * Establece la contraseña del usuario usando un token
   */
  async setPasswordWithToken(
    token: string,
    newPassword: string,
    ip?: string,
    ua?: string,
  ): Promise<User> {
    const passwordToken = await this.validatePasswordToken(token);

    // Hash de la nueva contraseña
    const passwordHash = await hash(newPassword);

    // Actualizar contraseña del usuario
    await this.usersService.updatePassword(passwordToken.userId, passwordHash);

    // Marcar token como usado
    await this.tokenRepo.update(passwordToken.id, {
      usedAt: new Date(),
      consumedIp: ip || null,
      consumedUserAgent: ua || null,
    });

    const user = await this.usersService.findById(passwordToken.userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Auditoría
    this.auditService
      .logPasswordSet(user.id)
      .catch((err) => this.logger.error(`Error en auditoría: ${err}`));

    return user;
  }

  /**
   * Marca el código como completamente usado después de enviar el formulario
   */
  async markInviteAsCompleted(inviteId: string): Promise<void> {
    await this.inviteRepo.update(inviteId, {
      usedAt: new Date(),
    });
    this.logger.log(`Invitación marcada como completada: ${inviteId}`);
  }

  /**
   * Regenera un código de invitación (invalida el anterior y crea uno nuevo)
   */
  async regenerateInviteCode(
    inviteId: string,
    newCode: string,
  ): Promise<{ invite: Invite; plainCode: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Buscar invitación original
      const originalInvite = await queryRunner.manager.findOne(Invite, {
        where: { id: inviteId },
      });

      if (!originalInvite) {
        throw new NotFoundException('Invitación no encontrada');
      }

      // Invalidar invitación anterior (marcar como usada)
      await queryRunner.manager.update(Invite, inviteId, {
        usedAt: new Date(),
        meta: {
          ...((originalInvite.meta as any) || {}),
          invalidatedReason: 'Código regenerado',
          invalidatedAt: new Date().toISOString(),
        },
      });

      // Crear nueva invitación con el mismo applicant y call
      const codeHash = await hash(newCode.toUpperCase());
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const newInvite = queryRunner.manager.create(Invite, {
        callId: originalInvite.callId,
        institutionId: originalInvite.institutionId,
        codeHash,
        expiresAt,
        usedByApplicant: originalInvite.usedByApplicant,
        usedAt: null,
        createdByUserId: originalInvite.createdByUserId,
        meta: {
          regeneratedFrom: inviteId,
          regeneratedAt: new Date().toISOString(),
        },
      });

      const savedInvite = await queryRunner.manager.save(newInvite);

      await queryRunner.commitTransaction();

      // Auditoría
      this.auditService
        .logInviteRegenerated(inviteId, savedInvite.id)
        .catch((err) => this.logger.error(`Error en auditoría: ${err}`));

      // Enviar email si hay applicant vinculado
      if (originalInvite.usedByApplicant) {
        const applicant = await this.dataSource.query(
          'SELECT email FROM applicants WHERE id = $1',
          [originalInvite.usedByApplicant],
        );

        if (applicant && applicant[0]?.email) {
          this.emailService
            .sendInviteResentEmail(applicant[0].email, newCode)
            .catch((err) => this.logger.error(`Error enviando email: ${err}`));
        }
      }

      this.logger.log(`Código regenerado para invitación: ${inviteId} -> ${savedInvite.id}`);

      return { invite: savedInvite, plainCode: newCode };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Envía email de invitación inicial al crear una invitación
   */
  async sendInitialInvite(
    inviteId: string,
    email: string,
    plainCode: string,
  ): Promise<void> {
    const invite = await this.inviteRepo.findOne({
      where: { id: inviteId },
    });

    if (!invite) {
      throw new NotFoundException('Invitación no encontrada');
    }

    // Obtener nombre de la convocatoria
    let callName: string | undefined;
    try {
      const call = await this.dataSource.query(
        'SELECT name FROM calls WHERE id = $1',
        [invite.callId],
      );
      callName = call[0]?.name;
    } catch (err) {
      this.logger.warn(`No se pudo obtener nombre de convocatoria: ${err}`);
    }

    await this.emailService.sendInitialInviteEmail(email, plainCode, callName);
    this.logger.log(`Email de invitación inicial enviado a: ${email}`);
  }

  /**
   * Calcula el dígito verificador de un RUT chileno
   */
  private calculateRutDV(rut: number): string {
    let sum = 0;
    let multiplier = 2;
    let rutStr = rut.toString();

    // Recorrer el RUT de derecha a izquierda
    for (let i = rutStr.length - 1; i >= 0; i--) {
      sum += parseInt(rutStr[i]) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }

    const remainder = sum % 11;
    const dv = 11 - remainder;

    if (dv === 11) return '0';
    if (dv === 10) return 'K';
    return dv.toString();
  }
}
