import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { StatsController } from './stats.controller';
import { ApplicationsService } from './applications.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [TypeOrmModule.forFeature([]), JwtModule.register({})],
  controllers: [ApplicationsController, StatsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
