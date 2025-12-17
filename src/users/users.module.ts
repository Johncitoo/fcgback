import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AdminUsersController } from './admin-users.controller';
import { UserAuthController } from './user-auth.controller';
import { User } from './entities/user.entity';
import { Admin2FACode } from './entities/admin-2fa-code.entity';
import { Admin2FAService } from './admin-2fa.service';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Admin2FACode]),
    ConfigModule,
    EmailModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [UsersController, AdminUsersController, UserAuthController],
  providers: [UsersService, Admin2FAService],
  exports: [UsersService],
})
export class UsersModule {}
