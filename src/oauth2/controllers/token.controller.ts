import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OAuthService } from '../services/oauth.service';
import { TokenIntrospectionRequestDto, TokenIntrospectionResponseDto, TokenRevocationRequestDto } from '../dto/token.dto';
import { OAuthGuard } from '../guards/oauth.guard';
import { Scopes } from '../decorators/scopes.decorator';
import { ApiExcluded } from '../../decorators/api-excluded.decorator';

@ApiTags('oauth2-tokens')
@ApiExcluded()
@Controller('oauth2')
@UseGuards(OAuthGuard)
export class TokenController {
  constructor(private readonly oauthService: OAuthService) {}

  @Post('introspect')
  @ApiOperation({ summary: 'Introspect a token' })
  @ApiResponse({ status: 200, type: TokenIntrospectionResponseDto })
  @Scopes('oauth2:introspect')
  async introspectToken(
    @Body() dto: TokenIntrospectionRequestDto
  ): Promise<TokenIntrospectionResponseDto> {
    return this.oauthService.introspectToken(dto.token);
  }

  @Post('revoke')
  @ApiOperation({ summary: 'Revoke a token' })
  @ApiResponse({ status: 200, description: 'Token revoked successfully' })
  @Scopes('oauth2:revoke')
  async revokeToken(@Body() dto: TokenRevocationRequestDto): Promise<void> {
    await this.oauthService.revokeToken(dto.token);
  }
} 