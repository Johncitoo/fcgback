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
import { MilestonesService } from '../milestones/milestones.service';
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
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
    private readonly milestonesService: MilestonesService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Busca una invitación por su código usando verificación de hash.
   * En modo DEV, acepta códigos usados para facilitar testing.
   * 
   * @param code - Código de invitación (se normaliza a mayúsculas)
   * @returns Invitación encontrada o null
   * 
   * @example
   * const invite = await findInviteByCode('ABC123');
   */
  async findInviteByCode(code: string): Promise<Invite | null> {
    const normalizedCode = code.trim().toUpperCase();
    
    // ⚠️ MODO DEV: Obtener TODAS las invitaciones (incluso las usadas) para facilitar testing
    // En producción, descomentar la línea de abajo y comentar la siguiente
    // const invites = await this.inviteRepo.find({ where: { usedAt: null as any } });
    const invites = await this.inviteRepo.find(); // ⚠️ DEV MODE: acepta códigos usados
    
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
   * Crea una invitación para desarrollo/testing.
   * Genera hash del código y establece fecha de expiración.
   * Puede incluir datos del postulante en metadata.
   * 
   * @param callId - ID de la convocatoria
   * @param code - Código de invitación (se hashea)
   * @param ttlDays - Días de validez (default: 30)
   * @param institutionId - ID de la institución opcional
   * @param firstName - Nombre del postulante opcional
   * @param lastName - Apellido del postulante opcional
   * @param email - Email del postulante opcional
   * @returns Invitación creada
   * 
   * @example
   * const invite = await devCreateInvite('uuid-call', 'TEST123', 30, null, 'Juan', 'Pérez', 'juan@example.com');
   */
  async devCreateInvite(
    callId: string,
    code: string,
    ttlDays?: number,
    institutionId?: string,
    firstName?: string,
    lastName?: string,
    email?: string,
  ): Promise<Invite> {
    const codeHash = await hash(code.toUpperCase());
    
    const ttl = ttlDays || 30;
    const expiresAt = new Date(Date.now() + ttl * 24 * 60 * 60 * 1000);

    // Guardar firstName, lastName y email en meta si se proporcionan
    const meta: any = {};
    if (firstName) meta.firstName = firstName;
    if (lastName) meta.lastName = lastName;
    if (email) meta.email = email;

    const invite = this.inviteRepo.create({
      callId,
      codeHash,
      expiresAt,
      institutionId: institutionId || null,
      usedByApplicant: null,
      usedAt: null,
      meta: Object.keys(meta).length > 0 ? meta : null,
      createdByUserId: null,
    });

    return this.inviteRepo.save(invite);
  }

  /**
   * Valida un código de invitación y prepara el onboarding del usuario.
   * Crea/actualiza usuario, applicant y application. Genera token de contraseña.
   * NO marca el código como usado hasta completar el formulario.
   * 
   * @param code - Código de invitación
   * @param email - Email del usuario (debe coincidir con el de la invitación)
   * @returns Objeto con user, invite, applicationId, passwordToken e isNewUser
   * @throws {NotFoundException} Si el código no existe
   * @throws {BadRequestException} Si el código expiró, fue usado o el email no coincide
   * 
   * @example
   * const result = await validateInviteCode('ABC123', 'user@example.com');
   * // { user: User, invite: Invite, applicationId: 'uuid', passwordToken: 'token', isNewUser: true }
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

      // Verificar que el código NO haya sido usado
      if (invite.usedAt || invite.usedByApplicant) {
        throw new BadRequestException('Este código ya ha sido utilizado. Si necesitas acceso nuevamente, contacta con el administrador para obtener un nuevo código.');
      }

      // VALIDACIÓN CRÍTICA: El email debe proporcionarse y debe coincidir con el del invite
      if (!email || email.trim() === '') {
        throw new BadRequestException('Debes proporcionar el email asociado a la invitación');
      }

      // Obtener el email del invite
      const inviteEmail = invite.meta?.testEmail || invite.meta?.email;
      if (!inviteEmail) {
        throw new BadRequestException('Este código no tiene un email asociado. Contacta al administrador.');
      }

      // Verificar que el email proporcionado coincida con el del invite
      if (email.trim().toLowerCase() !== inviteEmail.toLowerCase()) {
        throw new BadRequestException('El email proporcionado no coincide con el código de invitación. Verifica que sea el mismo email al que se envió la invitación.');
      }

      const finalEmail = inviteEmail; // Usar el email del invite (ya validado)
      this.logger.log(`Email validado correctamente: ${finalEmail}`);

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
        applicantId = existingUser.applicant_id;
        
        if (!applicantId || !existingUser.applicant_exists) {
          throw new BadRequestException('Usuario existe pero no tiene applicant asociado. Contacta soporte.');
        }

        // Crear objeto User desde el resultado de la query
        user = {
          id: existingUser.id,
          email: finalEmail,
          role: 'APPLICANT',
          applicantId: applicantId,
        } as User;

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

      // Vincular invitación con applicant y marcar como redimido INMEDIATAMENTE
      // (el constraint requiere que both used_by_applicant y used_at sean NULL o ambos tengan valor)
      await queryRunner.manager.query(
        'UPDATE invites SET used_by_applicant = $1, used_at = NOW() WHERE id = $2',
        [applicantId, invite.id],
      );

      // Crear o recuperar application para esta convocatoria
      let applicationId: string;
      let isNewApplication = false;
      const existingApp = await queryRunner.manager.query(
        'SELECT id FROM applications WHERE applicant_id = $1 AND call_id = $2 LIMIT 1',
        [applicantId, invite.callId],
      );

      if (existingApp && existingApp.length > 0) {
        applicationId = existingApp[0].id;
        this.logger.log(`Application existente recuperada: ${applicationId}`);
      } else {
        isNewApplication = true;
        const appResult = await queryRunner.manager.query(
          `INSERT INTO applications (applicant_id, call_id, status)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [applicantId, invite.callId, 'DRAFT'],
        );
        applicationId = appResult[0].id;
        this.logger.log(`Nueva application creada: ${applicationId}`);
      }

      // Inicializar milestone_progress si es necesario (nueva app o app existente sin progreso)
      try {
        // Verificar si ya tiene milestone_progress
        const existingProgress = await queryRunner.manager.query(
          'SELECT COUNT(*) as count FROM milestone_progress WHERE application_id = $1',
          [applicationId],
        );
        
        if (existingProgress[0].count === '0' || existingProgress[0].count === 0) {
          this.logger.log(`Inicializando milestone_progress para application: ${applicationId}`);
          await this.milestonesService.initializeProgress(applicationId, invite.callId);
          this.logger.log(`Milestone progress inicializado correctamente`);
        } else {
          this.logger.log(`Application ${applicationId} ya tiene ${existingProgress[0].count} milestone_progress`);
        }
      } catch (err) {
        this.logger.error(`Error inicializando milestone progress: ${err}`);
      }

      // Generar token para establecer contraseña (TTL: 10 minutos)
      const token = randomBytes(32).toString('hex');
      const tokenHash = await hash(token);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

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

    // Si es APPLICANT, asegurar que tenga milestone_progress inicializado
    if (user.role === 'APPLICANT' && user.applicantId) {
      try {
        // Buscar la aplicación activa del postulante
        const applications = await this.dataSource.query(
          'SELECT id, call_id FROM applications WHERE applicant_id = $1 ORDER BY created_at DESC LIMIT 1',
          [user.applicantId],
        );

        if (applications && applications.length > 0) {
          const app = applications[0];
          
          // Verificar si ya tiene milestone_progress
          const existingProgress = await this.dataSource.query(
            'SELECT COUNT(*) as count FROM milestone_progress WHERE application_id = $1',
            [app.id],
          );

          if (existingProgress[0].count === '0' || existingProgress[0].count === 0) {
            this.logger.log(`Inicializando milestone_progress para usuario ${user.email}, app: ${app.id}`);
            await this.milestonesService.initializeProgress(app.id, app.call_id);
            this.logger.log(`Milestone progress inicializado para ${user.email}`);
          } else {
            this.logger.log(`Usuario ${user.email} ya tiene ${existingProgress[0].count} milestone_progress`);
          }
        }
      } catch (err) {
        this.logger.error(`Error al inicializar milestone_progress para ${user.email}: ${err}`);
        // No lanzar error, solo loggear
      }
    }

    // Auditoría
    this.auditService
      .logPasswordSet(user.id)
      .catch((err) => this.logger.error(`Error en auditoría: ${err}`));

    // Enviar email de bienvenida
    this.emailService.sendWelcomeEmail(user.email, user.fullName || 'Usuario')
      .catch((err) => this.logger.error(`Error enviando email de bienvenida: ${err.message}`));

    return user;
  }

  /**
   * Marca el código como completamente usado después de enviar el formulario
   * ⚠️ COMENTADO PARA FACILITAR TESTING - DESCOMENTAR EN PRODUCCIÓN
   */
  async markInviteAsCompleted(inviteId: string): Promise<void> {
    // ⚠️ COMENTADO PARA FACILITAR TESTING - Los códigos nunca se marcan como usados
    // await this.inviteRepo.update(inviteId, {
    //   usedAt: new Date(),
    // });
    this.logger.log(`⚠️ [DEV MODE] Invitación NO marcada como usada: ${inviteId} - facilitar testing`);
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
    firstName?: string,
    lastName?: string,
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

    const fullName = firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || 'Postulante';
    await this.emailService.sendInitialInviteEmail(email, plainCode, callName, fullName);
    this.logger.log(`Email de invitación inicial enviado a: ${email} (${fullName})`);
  }

  /**
   * DEV ONLY - Establecer contraseña usando email directamente (sin token)
   */
  async devSetPasswordByEmail(
    email: string,
    password: string,
    ip?: string,
    userAgent?: string,
  ): Promise<User> {
    // Buscar usuario por email
    const user = await this.userRepo.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Validar longitud mínima de contraseña
    if (password.length < 6) {
      throw new BadRequestException('La contraseña debe tener al menos 6 caracteres');
    }

    // Hashear la nueva contraseña
    const passwordHash = await hash(password);

    // Actualizar la contraseña
    user.passwordHash = passwordHash;
    user.passwordUpdatedAt = new Date();
    user.lastLoginAt = new Date(); // Marcar como que "inició sesión"
    
    await this.userRepo.save(user);

    this.logger.log(`Contraseña establecida (DEV) para usuario: ${user.id}`);
    
    // Si es APPLICANT, asegurar que tenga milestone_progress inicializado
    if (user.role === 'APPLICANT' && user.applicantId) {
      try {
        // Buscar la aplicación activa del postulante
        const applications = await this.dataSource.query(
          'SELECT id, call_id FROM applications WHERE applicant_id = $1 ORDER BY created_at DESC LIMIT 1',
          [user.applicantId],
        );

        if (applications && applications.length > 0) {
          const app = applications[0];
          
          // Verificar si ya tiene milestone_progress
          const existingProgress = await this.dataSource.query(
            'SELECT COUNT(*) as count FROM milestone_progress WHERE application_id = $1',
            [app.id],
          );

          if (existingProgress[0].count === '0' || existingProgress[0].count === 0) {
            this.logger.log(`[DEV] Inicializando milestone_progress para usuario ${user.email}, app: ${app.id}`);
            await this.milestonesService.initializeProgress(app.id, app.call_id);
            this.logger.log(`[DEV] Milestone progress inicializado para ${user.email}`);
          } else {
            this.logger.log(`[DEV] Usuario ${user.email} ya tiene ${existingProgress[0].count} milestone_progress`);
          }
        }
      } catch (err) {
        this.logger.error(`[DEV] Error al inicializar milestone_progress para ${user.email}: ${err}`);
        // No lanzar error, solo loggear
      }
    }
    
    // Auditar
    await this.auditService.log({
      action: 'PASSWORD_SET_DEV',
      entity: 'user',
      entityId: user.id,
      actorUserId: user.id,
      meta: { email: user.email, ip, userAgent },
    });

    return user;
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
