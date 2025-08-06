import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsBoolean, ArrayMinSize, IsUrl, IsIn, IsInt, Min, IsEmail } from 'class-validator';

const allowedLifetimes = [0, 3600, 10800, 21600, 43200, 86400]; // 0 = non-expiring, 1, 3, 6, 12, 24 hours in seconds

export class CreateClientDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ 
    type: [String], 
    description: 'List of allowed redirect URIs',
    default: ['https://api.provident.ae/auth/callback']
  })
  @IsArray()
  @IsUrl({}, { each: true })
  @ArrayMinSize(1)
  @IsOptional()
  redirectUris?: string[] = ['https://api.provident.ae/auth/callback'];

  @ApiProperty({ type: [String], description: 'List of allowed scopes' })
  @IsArray()
  @ArrayMinSize(1)
  allowedScopes: string[];

  @ApiPropertyOptional({ 
    description: 'Token lifetime in seconds. Set to 0 for non-expiring token. Allowed values: 0 (non-expiring), 3600 (1h), 10800 (3h), 21600 (6h), 43200 (12h), 86400 (24h). Defaults to 3600 (1h).',
    default: 3600,
    enum: allowedLifetimes
  })
  @IsInt()
  @IsIn(allowedLifetimes)
  @IsOptional()
  tokenLifetimeSeconds?: number = 3600;

  @ApiPropertyOptional({ 
    description: 'Maximum number of requests allowed within the window. Set to 0 for unlimited. Defaults to 200.',
    default: 200,
    minimum: 0
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  rateLimitCount?: number = 200;

  @ApiPropertyOptional({ 
    description: 'Rate limit window size in seconds. Defaults to 43200 (12 hours).',
    default: 43200,
    minimum: 1
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  rateLimitWindowSeconds?: number = 43200;

  @ApiPropertyOptional({ description: 'Enable IP restriction for this client. Defaults to false.', default: false })
  @IsBoolean()
  @IsOptional()
  ipRestriction?: boolean = false;

  @ApiPropertyOptional({ type: [String], description: 'List of allowed IPs/CIDRs if restriction is enabled. Defaults to empty.', default: [] })
  @IsArray()
  @IsString({ each: true }) // Basic validation, more specific IP/CIDR validation could be added
  @IsOptional()
  allowedIps?: string[] = [];
}

export class UpdateClientDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsUrl({}, { each: true })
  @ArrayMinSize(1)
  @IsOptional()
  redirectUris?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsOptional()
  allowedScopes?: string[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Token lifetime in seconds. Set to 0 for non-expiring token. Allowed values: 0 (non-expiring), 3600 (1h), 10800 (3h), 21600 (6h), 43200 (12h), 86400 (24h).',
    enum: allowedLifetimes
  })
  @IsInt()
  @IsIn(allowedLifetimes)
  @IsOptional()
  tokenLifetimeSeconds?: number;

  @ApiPropertyOptional({ 
    description: 'Maximum number of requests allowed within the window. Set to 0 for unlimited.',
    minimum: 0
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  rateLimitCount?: number;

  @ApiPropertyOptional({ 
    description: 'Rate limit window size in seconds.',
    minimum: 1
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  rateLimitWindowSeconds?: number;

  @ApiPropertyOptional({ description: 'Enable IP restriction for this client.' })
  @IsBoolean()
  @IsOptional()
  ipRestriction?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'List of allowed IPs/CIDRs if restriction is enabled.' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedIps?: string[];
}

export class ClientResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  clientId: string;

  @ApiProperty()
  clientSecret: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: [String] })
  redirectUris: string[];

  @ApiProperty({ type: [String] })
  allowedScopes: string[];

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ description: 'Token lifetime in seconds' })
  tokenLifetimeSeconds: number;

  @ApiProperty({ description: 'Maximum requests allowed per window. 0 means unlimited.' })
  rateLimitCount: number;

  @ApiProperty({ description: 'Rate limit window size in seconds' })
  rateLimitWindowSeconds: number;

  @ApiProperty({ description: 'Whether IP restriction is enabled' })
  ip_restriction: boolean;

  @ApiProperty({ type: [String], description: 'List of allowed IPs/CIDRs' })
  allowedIps: string[];
} 