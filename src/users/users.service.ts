import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  async setLastLogin(userId: string) {
    await this.repo.update(userId, { lastLoginAt: new Date() });
  }

  async createStaffIfAllowed(email: string, fullName: string, passwordHash: string, role: Exclude<UserRole,'APPLICANT'>) {
    // Solo para desarrollo: requiere ALLOW_DEV_SEED=true
    const allow = process.env.ALLOW_DEV_SEED === 'true';
    if (!allow) return null;

    const exists = await this.repo.findOne({ where: { email } });
    if (exists) return exists;

    const u = this.repo.create({
      email,
      fullName,
      passwordHash,
      role,
      isActive: true,
      applicantId: null,
    });
    return this.repo.save(u);
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async createApplicantUser(email: string, fullName: string, passwordHash: string) {
    const u = this.repo.create({
      email,
      fullName,
      passwordHash,
      role: 'APPLICANT' as UserRole,
      isActive: true,
    });
    return this.repo.save(u);
  }

  async updatePassword(userId: string, passwordHash: string) {
    await this.repo.update(userId, { passwordHash, passwordUpdatedAt: new Date() });
  }
}
