import { Controller, Get, Query, UseGuards, Req, HttpCode, BadRequestException, UnauthorizedException, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { NoxumService } from './noxum.service';
import { OAuthGuard } from '../../oauth2/guards/oauth.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { DubaiunitfinderService } from '../dubaiunitfinder/dubaiunitfinder.service';
import { Request } from 'express';

@ApiTags('noxum')
@Controller('apps/noxum')
@UseGuards(OAuthGuard)
@ApiBearerAuth()
export class NoxumController {
  constructor(
    private readonly noxumService: NoxumService,
    private readonly dufService: DubaiunitfinderService,
  ) {}

  @Post('properties')
  @Scopes('noxum:properties:get')
  @ApiOperation({ 
    summary: 'Get properties data',
    description: 'Retrieves properties data from the specified URL'
  })
  @ApiQuery({ name: 'url', description: 'URL to fetch properties data from', required: true })
  @ApiQuery({ name: 'userId', description: 'DUF user ID (required if client is dubaiunitfinder)', required: false })
  @ApiResponse({
    status: 200,
    description: 'Properties data retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        endpoint: { type: 'string', example: 'properties' },
        url: { type: 'string', example: 'https://example.com' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Invalid scope' })
  @HttpCode(201)
  async getProperties(@Query('url') url: string, @Query('userId') userId: string | undefined, @Req() req: Request) {
    const clientName = (req as any)?.client?.name ? String((req as any).client.name).toLowerCase() : '';

    // Only allow known client databases; reject others
    const knownDbClients = new Set(['dubaiunitfinder']);
    if (clientName && !knownDbClients.has(clientName)) {
      throw new UnauthorizedException('Client not allowed');
    }

    // Perform the scrape first to build history payload
    const result = await this.noxumService.getProperties(url);

    if (clientName === 'dubaiunitfinder') {
      if (!userId) {
        throw new BadRequestException('userId is required for dubaiunitfinder client');
      }
      // Flatten nested structures for DUF history
      const loc = result?.location || {};
      const coords = result?.coordinates || {};
      const prop = result?.property || {};
      await this.dufService.addHistoryEntry({
        userId,
        requestUrl: url,
        preview: result?.property?.image_small_base64 || null,
        source: result?.source || undefined,
        emirate: loc?.emirate ?? null,
        mainArea: loc?.main_area ?? null,
        subArea: loc?.sub_area ?? null,
        subSubArea: loc?.sub_sub_area ?? null,
        fullName: loc?.full_name ?? null,
        areaNameEn: (result?.property?.zone_name ?? null),
        lat: (typeof coords?.lat === 'number' ? coords.lat : (coords?.lat ? Number(coords.lat) : null)),
        lng: (typeof (coords?.lon ?? coords?.lng) === 'number' ? (coords?.lon ?? coords?.lng) : ((coords?.lon ?? coords?.lng) ? Number(coords?.lon ?? coords?.lng) : null)),
        gmap: coords?.gmap ?? null,
        permitUrl: result?.rera?.permit_url ?? null,
        price: prop?.price ?? null,
        size: prop?.size ?? null,
        plotArea: prop?.plot_area ?? null,
        bedroomsValue: prop?.bedrooms_value ?? null,
        bathroomsValue: prop?.bathrooms_value ?? null,
        imageSmallUrl: prop?.image_small_url ?? null,
        company: result?.company || undefined,
        buildingName: result?.buildingName || undefined,
        unitNumber: result?.unitNumber || undefined,
        permitNumber: result?.rera?.permit_number || undefined,
        responseData: result,
        requestStatus: result?.success ? 'success' : 'failed',
      });
      // 201 with empty body
      return;
    }

    // If no client or knownDbClients not matched, reject (401) per spec
    if (!clientName) {
      throw new UnauthorizedException('Client not recognized');
    }

    // Fallback (should not reach here due to earlier checks)
    return;
  }

  @Get('floorplans')
  @Scopes('noxum:floorplans:get')
  @ApiOperation({ 
    summary: 'Get floorplans data',
    description: 'Retrieves floorplans data from the specified URL'
  })
  @ApiQuery({ name: 'url', description: 'URL to fetch floorplans data from', required: true })
  @ApiResponse({
    status: 200,
    description: 'Floorplans data retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        endpoint: { type: 'string', example: 'floorplans' },
        url: { type: 'string', example: 'https://example.com' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Invalid scope' })
  async getFloorplans(@Query('url') url: string) {
    return this.noxumService.getFloorplans(url);
  }

  @Get('owners')
  @Scopes('noxum:owners:get')
  @ApiOperation({ 
    summary: 'Get owners data',
    description: 'Retrieves owners data from the specified URL'
  })
  @ApiQuery({ name: 'url', description: 'URL to fetch owners data from', required: true })
  @ApiResponse({
    status: 200,
    description: 'Owners data retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        endpoint: { type: 'string', example: 'owners' },
        url: { type: 'string', example: 'https://example.com' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Invalid scope' })
  async getOwners(@Query('url') url: string) {
    return this.noxumService.getOwners(url);
  }

  @Get('liveowners')
  @Scopes('noxum:liveowners:get')
  @ApiOperation({ 
    summary: 'Get live owners data',
    description: 'Retrieves live owners data from the specified URL'
  })
  @ApiQuery({ name: 'url', description: 'URL to fetch live owners data from', required: true })
  @ApiResponse({
    status: 200,
    description: 'Live owners data retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        endpoint: { type: 'string', example: 'liveowners' },
        url: { type: 'string', example: 'https://example.com' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Invalid scope' })
  async getLiveOwners(@Query('url') url: string) {
    return this.noxumService.getLiveOwners(url);
  }

  @Get('combined/all')
  @Scopes('noxum:properties:get', 'noxum:floorplans:get', 'noxum:owners:get')
  @ApiOperation({ 
    summary: 'Get combined data (properties, floorplans, owners)',
    description: 'Retrieves properties, floorplans, and owners data from the specified URL'
  })
  @ApiQuery({ name: 'url', description: 'URL to fetch combined data from', required: true })
  @ApiResponse({
    status: 200,
    description: 'Combined data retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              endpoint: { type: 'string' },
              url: { type: 'string' }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Invalid scope' })
  async getCombinedAll(@Query('url') url: string) {
    return this.noxumService.getCombinedAll(url);
  }

  @Get('combined/properties-owners')
  @Scopes('noxum:properties:get', 'noxum:owners:get')
  @ApiOperation({ 
    summary: 'Get combined properties and owners data',
    description: 'Retrieves properties and owners data from the specified URL'
  })
  @ApiQuery({ name: 'url', description: 'URL to fetch combined data from', required: true })
  @ApiResponse({
    status: 200,
    description: 'Combined properties and owners data retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              endpoint: { type: 'string' },
              url: { type: 'string' }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Invalid scope' })
  async getCombinedPropertiesOwners(@Query('url') url: string) {
    return this.noxumService.getCombinedPropertiesOwners(url);
  }
}