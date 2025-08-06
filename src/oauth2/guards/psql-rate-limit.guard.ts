import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { OAuthClient } from '../entities/oauth-client.entity';
import { ClientRateLimitCount } from '../entities/client-rate-limit-count.entity';

export const SKIP_RATE_LIMIT = 'SKIP_RATE_LIMIT';
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT, true);

@Injectable()
export class PsqlRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(PsqlRateLimitGuard.name);
  
  private readonly defaultRateLimit = 200;
  private readonly defaultWindowSeconds = 43200; // Default to 12 hours

  constructor(
    private readonly reflector: Reflector,
    private readonly dataSource: DataSource,
    @InjectRepository(OAuthClient)
    private readonly clientRepository: Repository<OAuthClient>,
  ) {
    // No super call needed as we implement CanActivate directly
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.get<boolean>(
      SKIP_RATE_LIMIT,
      context.getHandler(),
    );
    if (skip) {
      return true;
    }

    const httpContext = context.switchToHttp();
    const req = httpContext.getRequest<any>();
    const res = httpContext.getResponse<any>();

    const initialClient: OAuthClient | undefined = req.client;

    if (!initialClient || !initialClient.clientId) {
      this.logger.debug('No client (clientId) found on request, skipping PSQL rate limit check.');
      return true; 
    }
    
    const clientIdentifier = initialClient.clientId;
    
    let currentLimit: number;
    let windowSeconds: number;
    try {
      const freshClient = await this.clientRepository.findOne({ 
          where: { clientId: clientIdentifier },
          select: ['rateLimitCount', 'rateLimitWindowSeconds', 'id']
      });
      if (!freshClient) {
        this.logger.warn(`Client ${clientIdentifier} not found during rate limit check (potentially deleted).`);
        throw new HttpException('Client not found', HttpStatus.UNAUTHORIZED);
      }
      currentLimit = freshClient.rateLimitCount ?? this.defaultRateLimit;
      windowSeconds = freshClient.rateLimitWindowSeconds ?? this.defaultWindowSeconds;

    } catch (error) {
        this.logger.error(`Error fetching fresh client ${clientIdentifier} config for rate limiting`, error);
        throw new HttpException(
            'Internal server error during rate limit config fetch',
            HttpStatus.INTERNAL_SERVER_ERROR,
        );
    }

    const currentDate = new Date().toISOString().split('T')[0];
    let currentCount = 0;
    try {
      const upsertQuery = `
        INSERT INTO client_rate_limit_counts ("clientId", date, count)
        VALUES ($1, $2, 1)
        ON CONFLICT ("clientId", date) DO UPDATE
        SET count = client_rate_limit_counts.count + 1
        RETURNING count;
      `;
      const result = await this.dataSource.query(upsertQuery, [
        clientIdentifier,
        currentDate,
      ]);

      if (result && result.length > 0) {
        currentCount = result[0].count;
      } else {
        this.logger.error('Failed to get count after UPSERT', { clientId: clientIdentifier, currentDate });
        currentCount = 1; 
      }

    } catch (error) {
      this.logger.error(`Error during rate limit Upsert query for client ${clientIdentifier}`, error);
      throw new HttpException(
        'Internal server error during rate limiting',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const remaining = Math.max(0, currentLimit - currentCount); 
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setUTCHours(23, 59, 59, 999);
    const resetTimeSeconds = Math.ceil((endOfDay.getTime() - now.getTime()) / 1000);

    res.header('X-RateLimit-Limit', currentLimit); 
    res.header('X-RateLimit-Remaining', remaining);
    res.header('X-RateLimit-Reset', resetTimeSeconds);

    if (currentLimit > 0 && currentCount > currentLimit) { 
      this.logger.warn(`Rate limit exceeded for client ${clientIdentifier}: ${currentCount}/${currentLimit}`);
      res.header('Retry-After', resetTimeSeconds);
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true; 
  }
} 