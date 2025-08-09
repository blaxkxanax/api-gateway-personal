import { Injectable, NestMiddleware, Logger, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { OAuthService } from '../oauth2/services/oauth.service';
import { OAuthClient } from '../oauth2/entities/oauth-client.entity';
import * as ipaddr from 'ipaddr.js';
import * as crypto from 'crypto';

interface TokenInfo {
  res_type: string;
  res_id: string;
  res_tokenClientId: string;
  res_tokenUserId: string;
  res_tokenScopes: string[];
  res_tokenExpiry: string;
  res_clientId: string;
  res_clientName: string;
  res_tokenId: string;
  res_tokenCreatedAt: string;
  res_tokenRevoked: boolean;
  res_clientAllowedScopes: string[];
  res_clientRedirectUris: string[];
  res_clientIsActive: boolean;
  res_clientCreatedAt: string;
}

@Injectable()
export class TokenLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TokenLoggingMiddleware.name);
  
  constructor(private readonly oauthService: OAuthService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const requestId = req['requestId'];
    let tokenInfo: TokenInfo | null = null;
    const chunks: Buffer[] = [];

    // Helper functions moved inside closure
    const parseResponseBody = (body: string): any => {
      try {
        return JSON.parse(body);
      } catch {
        return body;
      }
    };

    const sanitizeBody = (body: any): any => {
      if (!body) return body;
      
      const sanitized = { ...body };
      ['password', 'secret', 'token', 'apiKey'].forEach(field => {
        if (sanitized[field]) sanitized[field] = '********';
      });
            
      return sanitized;
    };

    // Capture response chunks
    const originalWrite = res.write;
    const originalEnd = res.end;

    // Function overloads for write
    const newWrite = function(chunk: any, encoding?: BufferEncoding | ((error: Error | null | undefined) => void), callback?: (error: Error | null | undefined) => void): boolean {
      chunks.push(Buffer.from(chunk));
      return originalWrite.apply(res, arguments);
    };
    res.write = newWrite;

    // Function overloads for end
    const newEnd = function(chunk?: any, encoding?: BufferEncoding | (() => void), callback?: () => void): Response {
      if (chunk) {
        chunks.push(Buffer.from(chunk));
      }
      
      const responseBuffer = Buffer.concat(chunks);
      const responseTime = Date.now() - startTime;
      const contentType = String(res.getHeader('content-type') || '');
      
      let responseBody: any;
      
      // Handle PDF responses specifically
      if (contentType.includes('application/pdf')) {
        const hash = crypto.createHash('sha256').update(responseBuffer).digest('hex');
        responseBody = `[PDF file generated, size: ${responseBuffer.length} bytes, sha256: ${hash}]`;
      } else {
        // Handle other responses as before
        const responseBodyString = responseBuffer.toString('utf8');
        responseBody = sanitizeBody(parseResponseBody(responseBodyString));
      }

      // Log response with token information
      Logger.log(`Outgoing response for ${req.method} ${req.url}`, {
        res_type: 'response',
        res_id: requestId,
        res_statusCode: res.statusCode,
        res_headers: res.getHeaders(),
        res_body: responseBody,
        res_time: responseTime,
        res_timestamp: new Date().toISOString(),
        ...(tokenInfo as Record<string, any>)
      });

      // Logger.log(responseBody, 'responseBody');

      return originalEnd.apply(res, arguments);
    };
    res.end = newEnd;

    // Process token if present and not a token creation request
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ') && !req.path.startsWith('/v2/oauth2/token')) {
      const token = authHeader.split(' ')[1];
      try {
        const validatedToken = await this.oauthService.validateToken(token);
        tokenInfo = {
          res_type: 'token_validation',
          res_id: requestId,
          res_tokenClientId: validatedToken.client?.clientId || '',
          res_tokenUserId: validatedToken.userId || '',
          res_tokenScopes: validatedToken.scopes || [],
          res_tokenExpiry: validatedToken.expiresAt ? validatedToken.expiresAt.toISOString() : '',
          res_clientId: validatedToken.client?.clientId || '',
          res_clientName: validatedToken.client?.name || '',
          res_tokenId: validatedToken.id || '',
          res_tokenCreatedAt: validatedToken.createdAt ? new Date(validatedToken.createdAt).toISOString() : '',
          res_tokenRevoked: validatedToken.revoked || false,
          res_clientAllowedScopes: validatedToken.client?.allowedScopes || [],
          res_clientRedirectUris: validatedToken.client?.redirectUris || [],
          res_clientIsActive: validatedToken.client?.isActive || false,
          res_clientCreatedAt: validatedToken.client?.createdAt ? new Date(validatedToken.client.createdAt).toISOString() : ''
        };
        
        // Update request logging data with validated token info
        if (req['updateValidatedTokenInfo']) {
          req['updateValidatedTokenInfo'](validatedToken);
        }

        // Attach token info to request for use in controllers
        req['user'] = validatedToken.user;
        req['scopes'] = validatedToken.scopes;
        req['client'] = validatedToken.client;

        // *** IP Restriction Check START ***
        const client = validatedToken.client as OAuthClient;
        if (client && client.ip_restriction) {
          // Prioritize Cloudflare header, then X-Forwarded-For, then req.ip
          const cfIp = req.headers['cf-connecting-ip'];
          const xff = req.headers['x-forwarded-for'];
          let potentialIp: string | undefined = undefined;

          if (typeof cfIp === 'string') {
            potentialIp = cfIp;
          } else if (typeof xff === 'string') {
            potentialIp = xff.split(',')[0].trim(); // Get the first IP if multiple
          } else if (Array.isArray(xff) && xff.length > 0) {
            potentialIp = xff[0].trim(); // Get the first IP if multiple
          } else {
            potentialIp = req.ip;
          }
          
          const requestIp = potentialIp;
          const allowedIps = client.allowedIps || [];

          this.logger.debug(`IP Restriction Check for client ${client.clientId}: Request IP = ${requestIp} (Source: ${cfIp ? 'CF' : (xff ? 'XFF' : 'req.ip')}), Allowed = [${allowedIps.join(', ')}]`);

          if (!requestIp) {
            this.logger.warn(`IP Restriction: Could not determine request IP for client ${client.clientId}. Denying access.`);
            throw new ForbiddenException('Access denied due to missing IP address.');
          }

          let isAllowed = false;
          try {
            // Ensure ipaddr is accessed correctly
            const addr = ipaddr.parse(requestIp);
            isAllowed = allowedIps.some(allowed => {
              try {
                if (allowed.includes('/')) { 
                  const cidr = ipaddr.parseCIDR(allowed);
                  if (addr.kind() === cidr[0].kind()) { // Match only same IP versions
                     // Use type assertion carefully after checking kind
                     if (addr.kind() === 'ipv4') {
                        return (addr as ipaddr.IPv4).match(cidr as [ipaddr.IPv4, number]);
                     } else {
                        return (addr as ipaddr.IPv6).match(cidr as [ipaddr.IPv6, number]);
                     }
                  } else {
                    return false; // Mismatched IP versions
                  }
                } else if (ipaddr.isValid(allowed)) { 
                   // Check for direct string match first (most common)
                   if (allowed === requestIp) return true;
                   // If direct match fails, parse and compare (handles IPv4-mapped IPv6 etc.)
                   const allowedAddr = ipaddr.parse(allowed);
                   return allowedAddr.kind() === addr.kind() && allowedAddr.toString() === addr.toString();
                } else {
                  this.logger.warn(`IP Restriction: Invalid entry in allowedIps for client ${client.clientId}: ${allowed}`);
                  return false;
                }
              } catch (parseError) {
                this.logger.error(`IP Restriction: Error parsing allowed IP/CIDR '${allowed}' for client ${client.clientId}: ${parseError.message}`);
                return false;
              }
            });
          } catch (parseError) {
            this.logger.error(`IP Restriction: Error parsing request IP '${requestIp}' for client ${client.clientId}: ${parseError.message}`, parseError.stack);
            isAllowed = false; 
          }

          if (!isAllowed) {
            this.logger.warn(`IP Restriction: Denied access for client ${client.clientId} from IP ${requestIp}. Not in allowed list.`);
            throw new ForbiddenException(`Access denied. Your IP address (${requestIp}) is not permitted.`);
          }

          this.logger.debug(`IP Restriction: Allowed access for client ${client.clientId} from IP ${requestIp}.`);
        }
        // *** IP Restriction Check END ***

        // Log request with token information
        Logger.log(`Incoming request ${req.method} ${req.url}`, {
          req_type: 'request',
          req_id: requestId,
          req_method: req.method,
          req_url: req.url,
          req_path: req.path,
          req_headers: req.headers,
          req_query: req.query,
          req_body: sanitizeBody(req.body),
          req_timestamp: new Date().toISOString(),
          req_ip: req.ip || req.socket?.remoteAddress || 'unknown',
          req_realIp: req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.ip || 'unknown',
          req_forwardedIp: req.headers['x-forwarded-for'] || 'none',
          req_cfRay: req.headers['cf-ray'] || 'none',
          req_cfIpCountry: req.headers['cf-ipcountry'] || 'unknown',
          ...(tokenInfo as Record<string, any>)
        });
      } catch (error) {
        if (error instanceof ForbiddenException) {
          throw error;
        }
        Logger.log(`Incoming request ${req.method} ${req.url}`, {
          req_type: 'request',
          req_id: requestId,
          res_id: requestId,
          req_method: req.method,
          req_url: req.url,
          req_path: req.path,
          req_headers: req.headers,
          req_query: req.query,
          req_body: sanitizeBody(req.body),
          req_timestamp: new Date().toISOString(),
          req_ip: req.ip || req.socket?.remoteAddress || 'unknown',
          req_realIp: req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.ip || 'unknown',
          req_forwardedIp: req.headers['x-forwarded-for'] || 'none',
          req_cfRay: req.headers['cf-ray'] || 'none',
          req_cfIpCountry: req.headers['cf-ipcountry'] || 'unknown',
          token_validation_error: error.message
        });
        this.logger.warn(`Token validation or IP check failed in logging middleware: ${error.message}`);
      }
    } else {
      // Log request without token information but with IP data
      Logger.log(`Incoming request ${req.method} ${req.url}`, {
        req_type: 'request',
        req_id: requestId,
        res_id: requestId,
        req_method: req.method,
        req_url: req.url,
        req_path: req.path,
        req_headers: req.headers,
        req_query: req.query,
        req_body: sanitizeBody(req.body),
        req_timestamp: new Date().toISOString(),
        req_ip: req.ip || req.socket?.remoteAddress || 'unknown',
        req_realIp: req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.ip || 'unknown',
        req_forwardedIp: req.headers['x-forwarded-for'] || 'none',
        req_cfRay: req.headers['cf-ray'] || 'none',
        req_cfIpCountry: req.headers['cf-ipcountry'] || 'unknown',
        ...(req.path.startsWith('/v2/oauth2/token') ? { res_id: requestId } : {})
      });
    }

    next();
  }
} 