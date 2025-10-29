import { Module } from '@nestjs/common';
import { FormController } from './form.controller';
import { AdminFormsController } from './admin-forms.controller';
import { PublicFormsController } from './public-forms.controller';
import { FormService } from './form.service';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [FormController, AdminFormsController, PublicFormsController],
  providers: [FormService],
  exports: [FormService],
})
export class FormModule {}
