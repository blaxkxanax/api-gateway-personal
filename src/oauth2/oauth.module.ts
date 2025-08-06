import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { OAuthController } from './controllers/oauth.controller';
import { ClientController } from './controllers/client.controller';
import { TokenController } from './controllers/token.controller';
import { OAuthService } from './services/oauth.service';
import { OAuthClient } from './entities/oauth-client.entity';
import { AccessToken } from './entities/access-token.entity';
import { ClientRateLimitCount } from './entities/client-rate-limit-count.entity';
import { User } from '../users/entities/user.entity';
import { ConfigModule } from '@nestjs/config';
import { PsqlRateLimitGuard } from './guards/psql-rate-limit.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OAuthClient,
      AccessToken,
      ClientRateLimitCount,
      User,
    ]),
    ConfigModule,
  ],
  controllers: [OAuthController, ClientController, TokenController],
  providers: [
    OAuthService,
    PsqlRateLimitGuard,
    {
      provide: APP_GUARD,
      useClass: PsqlRateLimitGuard,
    },
  ],
  exports: [OAuthService],
})
export class OAuthModule {} 