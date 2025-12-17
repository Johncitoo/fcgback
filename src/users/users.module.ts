import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AdminUsersController } from './admin-users.controller';
import { UserAuthController } from './user-auth.controller';
import { AdminManagementController } from './admin-management.controller';
import { User } from './entities/user.entity';
import { AdminVerificationCode } from './entities/admin-verification-code.entity';
import { Admin2FACode } from './entities/admin-2fa-code.entity';
import { AdminCreationService } from './admin-creation.service';
import { Admin2FAService } from './admin-2fa.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, AdminVerificationCode, Admin2FACode]),
    JwtModule,
    ConfigModule,
    EmailModule,
  ],
  controllers: [
    UsersController,
    AdminUsersController,
    UserAuthController,
    AdminManagementController,
  ],
  providers: [UsersService, AdminCreationService, Admin2FAService],
  exports: [UsersService],
})
export class UsersModule {}
