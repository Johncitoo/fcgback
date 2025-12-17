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
import { ReviewerVerificationCode } from './entities/reviewer-verification-code.entity';
import { PasswordChangeToken } from './entities/password-change-token.entity';
import { AdminCreationService } from './admin-creation.service';
import { Admin2FAService } from './admin-2fa.service';
import { ReviewerCreationService } from './reviewer-creation.service';
import { PasswordChangeService } from './password-change.service';
import { ReviewerManagementController } from './reviewer-management.controller';
import { PasswordChangeController } from './password-change.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, AdminVerificationCode, Admin2FACode, ReviewerVerificationCode, PasswordChangeToken]),
    JwtModule,
    ConfigModule,
    EmailModule,
  ],
  controllers: [
    UsersController,
    AdminUsersController,
    UserAuthController,
    AdminManagementController,
    ReviewerManagementController,
    PasswordChangeController,
  ],
  providers: [UsersService, AdminCreationService, Admin2FAService, ReviewerCreationService, PasswordChangeService],
  exports: [UsersService],
})
export class UsersModule {}
