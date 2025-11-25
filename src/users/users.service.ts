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

  // Buscar por email
  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  // Buscar por id
  findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  // Registrar último acceso
  async setLastLogin(userId: string): Promise<void> {
    await this.repo.update(userId, { lastLoginAt: new Date() });
  }

  // Crear usuario genérico
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

  // Crear usuarios STAFF en entorno DEV
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

  // Actualizar contraseña
  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.repo.update(userId, {
      passwordHash,
      passwordUpdatedAt: new Date(),
    });
  }
}
