import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { Call, FormSection, FormField } from './entities';

@Module({
  imports: [TypeOrmModule.forFeature([Call, FormSection, FormField])],
  controllers: [CallsController],
  providers: [CallsService],
  exports: [CallsService],
})
export class CallsModule {}
