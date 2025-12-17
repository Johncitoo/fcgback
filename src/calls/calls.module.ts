import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { CallsSchedulerService } from './calls-scheduler.service';
import { Call, FormSection, FormField } from './entities';
import { Form } from '../forms/entities/form.entity';
import { Milestone } from '../milestones/entities/milestone.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Call, FormSection, FormField, Form, Milestone]),
    forwardRef(() => AuthModule),
  ],
  controllers: [CallsController],
  providers: [CallsService, CallsSchedulerService],
  exports: [CallsService, CallsSchedulerService],
})
export class CallsModule {}
