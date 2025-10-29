import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { UserSession } from '../users/entities/user-session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserSession])],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService], // <- necesario para usarlo desde AuthService
})
export class SessionsModule {}
