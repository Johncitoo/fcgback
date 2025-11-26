import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { ApplicantsController } from './applicants.controller';

@Module({
  imports: [JwtModule, ConfigModule],
  controllers: [ApplicantsController],
})
export class ApplicantsModule {}
