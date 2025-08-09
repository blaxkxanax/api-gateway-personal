import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DubaiunitfinderController } from './dubaiunitfinder.controller';
import { DubaiunitfinderService } from './dubaiunitfinder.service';
import { DufUser } from './entities/duf-user.entity';
import { DufSubscription } from './entities/duf-subscription.entity';
import { DufHistory } from './entities/duf-history.entity';
import { OAuthModule } from '../../oauth2/oauth.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      name: 'dubaiunitfinder', // Named connection
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('dubaiunitfinder_database.host'),
        port: configService.get('dubaiunitfinder_database.port'),
        username: configService.get('dubaiunitfinder_database.username'),
        password: configService.get('dubaiunitfinder_database.password'),
        database: configService.get('dubaiunitfinder_database.database'),
        entities: [DufUser, DufSubscription, DufHistory],
        synchronize: true, // Set to false in production
        logging: false,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([DufUser, DufSubscription, DufHistory], 'dubaiunitfinder'),
    OAuthModule,
    ConfigModule,
  ],
  controllers: [DubaiunitfinderController],
  providers: [DubaiunitfinderService],
  exports: [DubaiunitfinderService],
})
export class DubaiunitfinderModule {}