import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageClientService } from './storage-client.service';
import { StorageClientController } from './storage-client.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [StorageClientController],
  providers: [StorageClientService],
  exports: [StorageClientService],
})
export class StorageClientModule {}
