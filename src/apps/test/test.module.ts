import { Module } from '@nestjs/common';
import { TestController } from './test.controller';
import { TestService } from './test.service';
import { OAuthModule } from '../../oauth2/oauth.module';

@Module({
  imports: [OAuthModule],
  controllers: [TestController],
  providers: [TestService],
})
export class TestModule {}