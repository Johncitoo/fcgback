import { Module } from '@nestjs/common';
import { SelectionController } from './selection.controller';

@Module({
  controllers: [SelectionController],
})
export class SelectionModule {}
