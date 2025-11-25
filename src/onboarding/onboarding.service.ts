import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Invite } from '../invites/invite.entity';
import { PasswordSetToken } from './entities/password-set-token.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { randomBytes } from 'crypto';
import { hash, verify } from 'argon2';

@Injectable()
export class OnboardingService {
  constructor(
    @InjectRepository(Invite)
    private readonly inviteRepo: Repository<Invite>,
    @InjectRepository(PasswordSetToken)
    private readonly tokenRepo: Repository<PasswordSetToken>,
    private readonly usersService: UsersService,
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
   * Valida un código de invitación y crea/obtiene usuario
   */
  async validateInviteCode(
    code: string,
  ): Promise<{ user: User; invite: Invite }> {
    const invite = await this.findInviteByCode(code);

    if (!invite) {
      throw new NotFoundException('Código de invitación no encontrado');
    }

    if (invite.usedAt) {
      throw new BadRequestException('El código ya fue utilizado');
    }

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new BadRequestException('El código ha expirado');
    }

    // Si ya tiene un applicant asociado, buscar el usuario
    if (invite.usedByApplicant) {
      // Buscar el usuario que tiene este applicantId
      const user = await this.dataSource.query(
        'SELECT * FROM users WHERE applicant_id = $1 LIMIT 1',
        [invite.usedByApplicant],
      );
      if (!user || user.length === 0) {
        throw new NotFoundException('Usuario no encontrado');
      }
      return { user: user[0], invite };
    }

    // Crear nuevo applicant (con datos placeholder que el usuario completará después)
    // Generar RUT válido con dígito verificador correcto
    const tempRut = Math.floor(Math.random() * 20000000) + 5000000;
    const dv = this.calculateRutDV(tempRut);
    
    const applicantResult = await this.dataSource.query(
      `INSERT INTO applicants (rut_number, rut_dv, first_name, last_name, email)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [tempRut, dv, 'Pendiente', 'Completar', null],
    );

    const applicantId = applicantResult[0].id;

    // Crear usuario vinculado al applicant
    const userId = randomBytes(8).toString('hex');
    const email = `temp_${userId}@pending.local`;
    const tempPassword = randomBytes(32).toString('hex');
    const passwordHash = await hash(tempPassword);

    const user = await this.usersService.createUser({
      email,
      fullName: `Postulante ${code}`,
      passwordHash,
      role: 'APPLICANT' as UserRole,
      isActive: true,
      applicantId: applicantId,
    });

    // Marcar invitación como usada
    await this.inviteRepo.update(invite.id, {
      usedByApplicant: applicantId,
      usedAt: new Date(),
    });

    return { user, invite };
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
