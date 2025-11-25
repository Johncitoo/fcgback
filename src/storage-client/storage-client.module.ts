import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageClientService } from './storage-client.service';
import { StorageClientController } from './storage-client.controller';

@Module({
  imports: [ConfigModule],
  controllers: [StorageClientController],
  providers: [StorageClientService],
  exports: [StorageClientService],
})
export class StorageClientModule {}
