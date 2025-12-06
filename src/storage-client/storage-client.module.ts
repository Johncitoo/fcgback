import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageClientService } from './storage-client.service';
import { StorageClientController } from './storage-client.controller';
import { AuthModule } from '../auth/auth.module';
import { FileMetadata } from './entities/file-metadata.entity';

@Module({
  imports: [
    ConfigModule, 
    AuthModule,
    TypeOrmModule.forFeature([FileMetadata])
  ],
  controllers: [StorageClientController],
  providers: [StorageClientService],
  exports: [StorageClientService],
})
export class StorageClientModule {}
