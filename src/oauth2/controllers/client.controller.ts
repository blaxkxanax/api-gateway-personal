import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OAuthService } from '../services/oauth.service';
import { CreateClientDto, UpdateClientDto, ClientResponseDto } from '../dto/client.dto';
import { OAuthGuard } from '../guards/oauth.guard';
import { Scopes } from '../decorators/scopes.decorator';
import { ApiExcluded } from '../../decorators/api-excluded.decorator';

@ApiTags('oauth2-clients')
@Controller('oauth2/clients')
@ApiExcluded()
@UseGuards(OAuthGuard)
@ApiBearerAuth()
export class ClientController {
  private readonly logger = new Logger(ClientController.name);

  constructor(private readonly oauthService: OAuthService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new OAuth client' })
  @ApiResponse({ status: 201, type: ClientResponseDto })
  @Scopes('admin:clients:create')
  async createClient(@Body() createClientDto: CreateClientDto, @Req() req) {
    // Determine the creator principal ID
    let creatorPrincipalId: string | undefined = undefined;

    if (req.user?.id) { 
      // If user exists (likely user token), use user ID
      creatorPrincipalId = req.user.id;
      this.logger.log(`Client creation request by user: ${creatorPrincipalId}`);
    } else if (req.client?.clientId) {
      // If no user, but client exists (client token), use client ID
      creatorPrincipalId = req.client.clientId; // Use the public clientId string
      this.logger.log(`Client creation request by client: ${creatorPrincipalId}`);
    } else {
      // Fallback/Error case
      console.warn('Creator principal ID not found in request (neither user nor client).');
      // Depending on requirements, you might throw an error here
    }

    // Pass the determined ID to the service
    return this.oauthService.createClient(createClientDto, creatorPrincipalId);
  }

  @Get()
  @ApiOperation({ summary: 'List all OAuth clients' })
  @ApiResponse({ status: 200, type: [ClientResponseDto] })
  @Scopes('admin:clients:read')
  async listClients() {
    return this.oauthService.listClients();
  }

  @Get(':clientId')
  @ApiOperation({ summary: 'Get an OAuth client by Client ID' })
  @ApiResponse({ status: 200, type: ClientResponseDto })
  @Scopes('admin:clients:read')
  async getClient(@Param('clientId') clientId: string) {
    return this.oauthService.getClientByClientId(clientId);
  }

  @Put(':clientId')
  @ApiOperation({ summary: 'Update an OAuth client by Client ID' })
  @ApiResponse({ status: 200, type: ClientResponseDto })
  @Scopes('admin:clients:update')
  async updateClient(
    @Param('clientId') clientId: string,
    @Body() updateClientDto: UpdateClientDto,
  ) {
    return this.oauthService.updateClient(clientId, updateClientDto);
  }

  @Delete(':clientId')
  @ApiOperation({ summary: 'Deactivate an OAuth client by Client ID (sets isActive=false)' })
  @ApiResponse({ status: 200, type: ClientResponseDto })
  @Scopes('admin:clients:delete')
  async deleteClient(@Param('clientId') clientId: string): Promise<ClientResponseDto> {
    return this.oauthService.deleteClient(clientId);
  }

  @Post(':clientId/rotate-secret')
  @ApiOperation({ summary: 'Rotate client secret by Client ID' })
  @ApiResponse({ status: 200, description: 'Returns new client secret' })
  @Scopes('admin:clients:update')
  async rotateClientSecret(@Param('clientId') clientId: string) {
    return this.oauthService.rotateClientSecret(clientId);
  }
} 