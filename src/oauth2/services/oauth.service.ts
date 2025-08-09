import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { OAuthClient } from '../entities/oauth-client.entity';
import { AccessToken } from '../entities/access-token.entity';
import { User } from '../../users/entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { CreateClientDto, UpdateClientDto } from '../dto/client.dto';
import { TokenIntrospectionResponseDto } from '../dto/token.dto';
import { Logger } from '@nestjs/common';

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    @InjectRepository(OAuthClient)
    private clientRepository: Repository<OAuthClient>,
    @InjectRepository(AccessToken)
    private tokenRepository: Repository<AccessToken>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private configService: ConfigService,
  ) {}

  async validateClient(clientId: string, clientSecret: string, validateSecret = true): Promise<OAuthClient> {
    console.log('validateClient called with:', { clientId, clientSecret, validateSecret });
    
    const client = await this.clientRepository.findOne({
      where: { clientId, isActive: true },
    });

    console.log('Database query result:', client);

    if (!client) {
      console.log('Client not found or not active');
      throw new UnauthorizedException('Invalid client credentials');
    }

    if (validateSecret && client.clientSecret !== clientSecret) {
      console.log('Client secret mismatch');
      console.log('Expected:', client.clientSecret);
      console.log('Received:', clientSecret);
      throw new UnauthorizedException('Invalid client credentials');
    }

    return client;
  }

  async generateClientCredentialsToken(client: OAuthClient): Promise<AccessToken> {
    console.log('Generating client credentials token for client:', client);
    console.log('Client allowed scopes:', client.allowedScopes);
    
    // Clean the scopes by removing curly braces
    const cleanScopes = client.allowedScopes.map(scope => 
      scope.replace(/[{}]/g, '').trim()
    );
    console.log('Cleaned scopes:', cleanScopes);

    const accessToken = this.generateSecureToken(32); // Generate a 64-character token

    let expiresAt: Date;
    const lifetime = client.tokenLifetimeSeconds ?? 3600;

    if (lifetime === 0) {
      // For non-expiring tokens, set a date far in the future
      expiresAt = new Date('9999-12-31T23:59:59Z');
    } else {
      expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + lifetime);
    }

    const token = this.tokenRepository.create({
      accessToken,
      scopes: cleanScopes,
      expiresAt,
      client,
      clientId: client.id,
    });

    console.log('Created token with scopes:', token.scopes);
    const savedToken = await this.tokenRepository.save(token);
    console.log('Saved token with scopes:', savedToken.scopes);

    return savedToken;
  }

  async validateToken(accessToken: string): Promise<AccessToken> {
    console.log('Validating access token:', accessToken);
    
    const token = await this.tokenRepository.findOne({
      where: {
        accessToken,
        revoked: false,
      },
      relations: ['client'],
    });

    if (token) {
      // Clean the scopes by removing curly braces
      token.scopes = token.scopes.map(scope => 
        scope.replace(/[{}]/g, '').trim()
      );
    }

    console.log('Token found in database:', token);
    console.log('Token scopes from database (cleaned):', token?.scopes);
    console.log('Token client allowed scopes:', token?.client?.allowedScopes);

    console.log('Token validation:');
    console.log('Current time:', new Date().toISOString());
    console.log('Token expires at:', token?.expiresAt?.toISOString());

    if (!token) {
      throw new UnauthorizedException('Invalid access token');
    }
    
    // If the client has a non-expiring lifetime, skip expiration check
    if (token.client && token.client.tokenLifetimeSeconds === 0) {
      return token;
    }

    if (token.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid access token');
    }

    return token;
  }

  private generateSecureToken(length: number): string {
    return randomBytes(length).toString('hex');
  }

  private validateScopes(requestedScopes: string[], allowedScopes: string[]): string[] {
    const validScopes = requestedScopes.filter(scope => allowedScopes.includes(scope));
    if (validScopes.length === 0) {
      throw new BadRequestException('No valid scopes provided');
    }
    return validScopes;
  }

  // Client Management Methods
  async createClient(createClientDto: CreateClientDto, creatorId?: string): Promise<OAuthClient> {
    const clientId = this.generateSecureToken(32);
    const clientSecret = this.generateSecureToken(32);

    const client = this.clientRepository.create({
      ...createClientDto,
      clientId,
      clientSecret,
      redirectUris: createClientDto.redirectUris || ['http://localhost:9000/auth/callback'],
      creatorPrincipalId: creatorId, // Use the renamed field
      // Explicitly map fields with different casing
      ip_restriction: createClientDto.ipRestriction,
      allowedIps: createClientDto.allowedIps
    });

    this.logger.log(`Creating client ${clientId} requested by principal ${creatorId}`);
    return this.clientRepository.save(client);
  }

  async getClient(id: string): Promise<OAuthClient> {
    const client = await this.clientRepository.findOne({ where: { id } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    return client;
  }

  async getClientByClientId(clientId: string): Promise<OAuthClient> {
    const client = await this.clientRepository.findOne({ where: { clientId } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    return client;
  }

  async listClients(): Promise<OAuthClient[]> {
    return this.clientRepository.find();
  }

  async updateClient(clientId: string, updateClientDto: UpdateClientDto): Promise<OAuthClient> {
    const client = await this.getClientByClientId(clientId);
    
    // Destructure DTO to separate handled fields from the rest
    const { 
      ipRestriction, 
      allowedIps, 
      ...restDto 
    } = updateClientDto;

    // Assign the rest of the DTO properties that match entity properties
    // This works for fields like 'name', 'redirectUris', 'allowedScopes', 'isActive',
    // 'tokenLifetimeSeconds', 'rateLimitCount', 'rateLimitWindowSeconds' 
    // because their names match between UpdateClientDto and OAuthClient entity (after TypeORM mapping).
    Object.assign(client, restDto);

    // Explicitly map fields with different casing if they exist in the DTO
    if (ipRestriction !== undefined) {
      client.ip_restriction = ipRestriction;
    }
    if (allowedIps !== undefined) {
      client.allowedIps = allowedIps;
    }
    
    return this.clientRepository.save(client);
  }

  async deleteClient(clientId: string): Promise<OAuthClient> {
    const client = await this.getClientByClientId(clientId);
    // Perform soft delete by setting isActive to false
    client.isActive = false; 
    this.logger.log(`Deactivating client ${client.clientId}`);
    return this.clientRepository.save(client); // Save the change and return updated client
  }

  async rotateClientSecret(clientId: string): Promise<{ clientSecret: string }> {
    const client = await this.getClientByClientId(clientId);
    const clientSecret = this.generateSecureToken(32);
    
    client.clientSecret = clientSecret;
    await this.clientRepository.save(client);
    
    return { clientSecret };
  }

  async introspectToken(token: string): Promise<TokenIntrospectionResponseDto> {
    const accessToken = await this.tokenRepository.findOne({
      where: { accessToken: token },
      relations: ['client'],
    });

    if (!accessToken) {
      throw new NotFoundException('Token not found');
    }

    // Load the user separately if needed, potentially based on accessToken.userId if it exists
    // For client credentials tokens, accessToken.userId will be null.
    let username: string | undefined = undefined;
    if (accessToken.userId) {
      const user = await this.userRepository.findOne({ where: { id: accessToken.userId } });
      username = user?.email;
    }

    const isExpired = accessToken.expiresAt.getTime() < Date.now();

    return {
      active: !accessToken.revoked && !isExpired,
      client_id: accessToken.client.clientId,
      username: username,
      scope: accessToken.scopes.join(' '),
      exp: Math.floor(accessToken.expiresAt.getTime() / 1000),
      iat: Math.floor(accessToken.createdAt.getTime() / 1000),
    };
  }

  async revokeToken(token: string): Promise<void> {
    const accessToken = await this.tokenRepository.findOne({
      where: { accessToken: token },
    });

    if (!accessToken) {
      throw new NotFoundException('Token not found');
    }

    accessToken.revoked = true;
    await this.tokenRepository.save(accessToken);
  }
} 