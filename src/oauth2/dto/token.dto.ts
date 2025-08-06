import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class TokenIntrospectionRequestDto {
  @ApiProperty({
    description: 'The token to introspect',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class TokenIntrospectionResponseDto {
  @ApiProperty({
    description: 'Boolean indicating whether the token is active',
  })
  active: boolean;

  @ApiProperty({
    description: 'Client ID associated with the token',
  })
  client_id: string;

  @ApiProperty({
    description: 'Username of the associated user, if any',
    required: false,
  })
  username?: string;

  @ApiProperty({
    description: 'Space-separated list of scopes',
  })
  scope: string;

  @ApiProperty({
    description: 'Token expiration timestamp in seconds since epoch',
  })
  exp: number;

  @ApiProperty({
    description: 'Token issuance timestamp in seconds since epoch',
  })
  iat: number;
}

export class TokenRevocationRequestDto {
  @ApiProperty({
    description: 'The token to revoke',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
} 