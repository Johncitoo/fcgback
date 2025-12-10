import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: ('ADMIN' | 'REVIEWER' | 'APPLICANT')[]) =>
  SetMetadata(ROLES_KEY, roles);
