import { Module } from '@nestjs/common';
import { NoxumController } from './noxum.controller';
import { NoxumService } from './noxum.service';
import { OAuthModule } from '../../oauth2/oauth.module';
import { DubaiunitfinderModule } from '../dubaiunitfinder/dubaiunitfinder.module';

@Module({
  imports: [OAuthModule, DubaiunitfinderModule],
  controllers: [NoxumController],
  providers: [NoxumService],
})
export class NoxumModule {}