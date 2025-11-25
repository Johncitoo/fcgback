import { Module } from '@nestjs/common';
import { MigrationsController } from './migrations.controller';

@Module({
  controllers: [MigrationsController],
})
export class MigrationsModule {}
