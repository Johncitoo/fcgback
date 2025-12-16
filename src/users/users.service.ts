import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';

interface CreateUserData {
  email: string;
  fullName: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  applicantId?: string | null;
}

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  /**
   * Busca un usuario por su email.
   * 
   * @param email - Email del usuario
   * @returns Usuario encontrado o null
   * 
   * @example
   * const user = await findByEmail('user@example.com');
   */
  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  /**
   * Busca un usuario por su ID.
   * 
   * @param id - ID del usuario
   * @returns Usuario encontrado o null
   * 
   * @example
   * const user = await findById('uuid-123');
   */
  findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  /**
   * Registra el último acceso del usuario.
   * Actualiza el campo lastLoginAt con la fecha/hora actual.
   * 
   * @param userId - ID del usuario
   * 
   * @example
   * await setLastLogin('uuid-123');
   */
  async setLastLogin(userId: string): Promise<void> {
    await this.repo.update(userId, { lastLoginAt: new Date() });
  }

  /**
   * Crea un usuario genérico con cualquier rol.
   * 
   * @param data - Datos del usuario (email, fullName, passwordHash, role, etc.)
   * @returns Usuario creado
   * @throws {ConflictException} Si el email ya existe
   * 
   * @example
   * const user = await createUser({ email: 'admin@example.com', fullName: 'Admin', passwordHash: 'hash', role: 'ADMIN', isActive: true });
   */
  async createUser(data: CreateUserData): Promise<User> {
    const exists = await this.repo.findOne({ where: { email: data.email } });
    if (exists) {
      throw new ConflictException('Email already exists');
    }

    const user = this.repo.create({
      email: data.email,
      fullName: data.fullName,
      passwordHash: data.passwordHash,
      role: data.role,
      isActive: data.isActive,
      applicantId: data.applicantId ?? null,
    });

    return this.repo.save(user);
  }

  /**
   * Crea un usuario con rol APPLICANT.
   * Atajo para crear postulantes rápidamente.
   * 
   * @param email - Email del postulante
   * @param fullName - Nombre completo
   * @param passwordHash - Hash de la contraseña
   * @returns Usuario postulante creado
   * 
   * @example
   * const user = await createApplicantUser('postulante@example.com', 'Juan Pérez', 'hash123');
   */
  async createApplicantUser(
    email: string,
    fullName: string,
    passwordHash: string,
  ) {
    const u = this.repo.create({
      email,
      fullName,
      passwordHash,
      role: 'APPLICANT' as UserRole, // ← usamos string + as UserRole
      isActive: true,
      applicantId: null,
    });

    return this.repo.save(u);
  }

  /**
   * Crea usuarios STAFF (ADMIN/REVIEWER) solo en entorno de desarrollo.
   * Requiere ALLOW_DEV_SEED=true en variables de entorno.
   * 
   * @param email - Email del staff
   * @param fullName - Nombre completo
   * @param passwordHash - Hash de la contraseña
   * @param role - Rol del staff (ADMIN o REVIEWER)
   * @returns Usuario creado o existente, null si no está permitido
   * 
   * @example
   * const admin = await createStaffIfAllowed('admin@example.com', 'Admin User', 'hash', 'ADMIN');
   */
  async createStaffIfAllowed(
    email: string,
    fullName: string,
    passwordHash: string,
    role: Exclude<UserRole, 'APPLICANT'>,
  ): Promise<User | null> {
    const allow = process.env.ALLOW_DEV_SEED === 'true';
    if (!allow) return null;

    const exists = await this.repo.findOne({ where: { email } });
    if (exists) return exists;

    const user = this.repo.create({
      email,
      fullName,
      passwordHash,
      role,
      isActive: true,
      applicantId: null,
    });

    return this.repo.save(user);
  }

  /**
   * Actualiza la contraseña de un usuario.
   * Actualiza passwordHash y passwordUpdatedAt.
   * 
   * @param userId - ID del usuario
   * @param passwordHash - Nuevo hash de contraseña
   * 
   * @example
   * await updatePassword('uuid-123', 'newHash456');
   */
  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.repo.update(userId, {
      passwordHash,
      passwordUpdatedAt: new Date(),
    });
  }
}
