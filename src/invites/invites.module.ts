import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invite } from './invite.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Invite])],
  exports: [TypeOrmModule],
})
export class InvitesModule {}
