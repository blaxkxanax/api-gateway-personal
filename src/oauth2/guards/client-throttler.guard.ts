import { Injectable, ExecutionContext, Inject } from '@nestjs/common';
import { 
  ThrottlerGuard, 
  ThrottlerOptions, 
  ThrottlerException, 
  ThrottlerStorage, 
  ThrottlerModuleOptions // Keep this if needed by super()
} from '@nestjs/throttler';
import { OAuthService } from '../services/oauth.service';
import { OAuthClient } from '../entities/oauth-client.entity';
import { Reflector } from '@nestjs/core';
// ConfigService might be needed for global defaults if options injection fails
// import { ConfigService } from '@nestjs/config'; 

@Injectable()
export class ClientThrottlerGuard extends ThrottlerGuard {

  // Store the default options retrieved from the module
  private defaultOptions: ThrottlerOptions;

  constructor(
    // Try injecting ThrottlerStorage by type/class token
    @Inject(ThrottlerStorage) protected readonly storageService: ThrottlerStorage,
    protected readonly reflector: Reflector,
    @Inject(OAuthService) private readonly oauthService: OAuthService,
    // @Inject(ConfigService) private readonly configService: ConfigService, // Optional: if needed for defaults
  ) {
    // Define minimal module options, hoping the base guard handles missing parts
    // Or, fetch defaults from ConfigService if injected
    const minimalModuleOptions: ThrottlerModuleOptions = {
        throttlers: [{ limit: 200, ttl: 86400 }], // Provide a fallback default
        // storage: storageService, // Storage is passed as a separate arg to super()
    };
    super(minimalModuleOptions, storageService, reflector);
    // Store the default for easier access in resolveOptions
    this.defaultOptions = minimalModuleOptions.throttlers[0];
  }

  // Ensure the tracker returns a Promise<string>
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const clientId = req.client?.clientId;
    return clientId || req.ip; 
  }

  // Override resolveOptions to provide client-specific limits
  protected async resolveOptions(context: ExecutionContext): Promise<ThrottlerOptions> {
    const req = this.getRequestResponse(context).req;
    const client: OAuthClient | undefined = req.client;

    // Use the stored default options
    const defaultLimit = this.defaultOptions.limit;
    const defaultTtl = this.defaultOptions.ttl;

    if (client?.clientId) {
      const limit = client.rateLimitCount || defaultLimit;
      const ttl = client.rateLimitWindowSeconds || defaultTtl;
      console.log(`ClientThrottlerGuard resolved limits for ${client.clientId}: ${limit}/${ttl}s`);
      return { limit, ttl }; 
    } else {
      console.warn(`ClientThrottlerGuard using default limits: ${defaultLimit}/${defaultTtl}s`);
      return { limit: defaultLimit, ttl: defaultTtl };
    }
  }
  
  // No handleRequest override - relying on base implementation with resolved options
  // No throwThrottlingException override - relying on base implementation
} 