import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { OAuthService } from '../services/oauth.service';
import { Reflector } from '@nestjs/core';

@Injectable()
export class OAuthGuard implements CanActivate {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('No authorization header');
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer') {
      throw new UnauthorizedException('Invalid token type');
    }

    try {
      // Token validation is already done by middleware
      // Just check if we have the required scopes
      const requiredScopes = this.reflector.get<string[]>('scopes', context.getHandler());
      
      if (requiredScopes && (!request.scopes || !Array.isArray(request.scopes))) {
        throw new UnauthorizedException('Invalid token');
      }
      
      if (requiredScopes) {
        const hasRequiredScopes = requiredScopes.every(scope => 
          request.scopes.includes(scope)
        );
        
        if (!hasRequiredScopes) {
          throw new UnauthorizedException('Insufficient scopes');
        }
      }

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid token');
    }
  }
} 