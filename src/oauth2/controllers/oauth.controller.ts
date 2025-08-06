import { Controller, Post, Body, Req, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { OAuthService } from '../services/oauth.service';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';

@Controller('oauth2')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(
    private readonly oauthService: OAuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('token')
  async token(
    @Req() req: Request,
    @Body('grant_type') grantType: string,
    @Body('client_id') clientId: string,
    @Body('client_secret') clientSecret: string,
  ) {
    this.logger.debug('Token endpoint called');
    this.logger.debug('Headers:', JSON.stringify(req.headers, null, 2));
    this.logger.debug('Raw body:', req.body);
    this.logger.debug('Content-Type:', req.headers['content-type']);
    this.logger.debug(`Extracted parameters:
      grant_type: ${grantType}
      client_id: ${clientId}
      client_secret: ${clientSecret}
    `);

    try {
      if (grantType !== 'client_credentials') {
        throw new BadRequestException('Invalid grant type - only client_credentials is supported');
      }

      this.logger.debug('Using client credentials flow');
      console.log('Attempting to validate client with:');
      console.log('clientId:', clientId);
      console.log('clientSecret:', clientSecret);
      
      const client = await this.oauthService.validateClient(clientId, clientSecret);
      console.log('Client validation result:', client);
      
      const token = await this.oauthService.generateClientCredentialsToken(client);
      console.log('Generated token:', token);

      return {
        access_token: token.accessToken,
        token_type: 'Bearer',
        expires_in: Math.floor((token.expiresAt.getTime() - Date.now()) / 1000),
        scope: token.scopes.join(' '),
      };
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }
} 