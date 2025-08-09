import { Controller, Get, Post, Body, Query, UseGuards, Headers, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery, ApiBody, ApiHeader } from '@nestjs/swagger';
import { DubaiunitfinderService } from './dubaiunitfinder.service';
import { OAuthGuard } from '../../oauth2/guards/oauth.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';

@ApiTags('dubaiunitfinder')
@Controller('apps/dubaiunitfinder')
@UseGuards(OAuthGuard)
@ApiBearerAuth()
@ApiHeader({ name: 'x-api-key', description: 'API key for additional security (will be implemented later)', required: false })
export class DubaiunitfinderController {
  constructor(private readonly dubaiunitfinderService: DubaiunitfinderService) {}

  // Authentication Endpoints
  @Post('auth/register')
  @Scopes('dubaiunitfinder:auth:register')
  @ApiOperation({ 
    summary: 'Register new user',
    description: 'Register a new user for Dubai Unit Finder platform'
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['firstName', 'lastName', 'email', 'password'],
      properties: {
        firstName: { type: 'string', example: 'John' },
        lastName: { type: 'string', example: 'Doe' },
        email: { type: 'string', example: 'john.doe@example.com' },
        password: { type: 'string', example: 'SecurePass123!' },
        company: { type: 'string', example: 'Real Estate Co.' },
        referredBy: { type: 'string', example: 'ABC123XYZ456' }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'User registered successfully' },
        userId: { type: 'string', example: 'uuid-here' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'User already exists or invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Invalid scope' })
  async register(
    @Body() userData: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      company?: string;
      referredBy?: string;
    },
    @Headers('x-api-key') apiKey?: string
  ) {
    // TODO: Implement x-api-key validation later
    return this.dubaiunitfinderService.registerUser(userData);
  }

  @Post('auth/signin')
  @Scopes('dubaiunitfinder:auth:signin')
  @ApiOperation({ 
    summary: 'Sign in user',
    description: 'Sign in an existing user to Dubai Unit Finder platform'
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', example: 'john.doe@example.com' },
        password: { type: 'string', example: 'SecurePass123!' }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Sign in successful',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Sign in successful' },
        user: { type: 'object' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Forbidden - Invalid scope' })
  async signIn(
    @Body() credentials: { email: string; password: string },
    @Headers('x-api-key') apiKey?: string
  ) {
    // TODO: Implement x-api-key validation later
    return this.dubaiunitfinderService.signInUser(credentials.email, credentials.password);
  }

  // Subscription Endpoints
  @Get('subscription/:userId')
  @Scopes('dubaiunitfinder:subscription:read')
  @ApiOperation({ 
    summary: 'Get user subscriptions',
    description: 'Retrieve all subscriptions for a specific user'
  })
  @ApiResponse({
    status: 200,
    description: 'Subscriptions retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        subscriptions: { type: 'array', items: { type: 'object' } }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Invalid scope' })
  async getUserSubscriptions(
    @Param('userId') userId: string,
    @Headers('x-api-key') apiKey?: string
  ) {
    // TODO: Implement x-api-key validation later
    return this.dubaiunitfinderService.getUserSubscriptions(userId);
  }

  @Post('subscription')
  @Scopes('dubaiunitfinder:subscription:create')
  @ApiOperation({ 
    summary: 'Create new subscription',
    description: 'Create a new subscription for a user'
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['userId', 'packageName', 'requestsInPackage', 'expiryDate'],
      properties: {
        userId: { type: 'string', example: 'uuid-here' },
        packageName: { type: 'string', example: 'premium' },
        requestsInPackage: { type: 'number', example: 1000 },
        expiryDate: { type: 'string', format: 'date', example: '2024-12-31' },
        price: { type: 'number', example: 99.99 }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Subscription created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Subscription created successfully' },
        subscriptionId: { type: 'string', example: 'uuid-here' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid subscription data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Invalid scope' })
  async createSubscription(
    @Body() subscriptionData: {
      userId: string;
      packageName: string;
      requestsInPackage: number;
      expiryDate: string;
      price?: number;
    },
    @Headers('x-api-key') apiKey?: string
  ) {
    // TODO: Implement x-api-key validation later
    const expiryDate = new Date(subscriptionData.expiryDate);
    return this.dubaiunitfinderService.createSubscription({
      ...subscriptionData,
      expiryDate
    });
  }

  // History Endpoints
  @Get('history/:userId')
  @Scopes('dubaiunitfinder:history:read')
  @ApiOperation({ 
    summary: 'Get user history',
    description: 'Retrieve search history for a specific user'
  })
  @ApiQuery({ name: 'limit', description: 'Number of records to return', required: false, example: 50 })
  @ApiResponse({
    status: 200,
    description: 'History retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        history: { type: 'array', items: { type: 'object' } }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Invalid scope' })
  async getUserHistory(
    @Param('userId') userId: string,
    @Query('limit') limit?: number,
    @Headers('x-api-key') apiKey?: string
  ) {
    // TODO: Implement x-api-key validation later
    return this.dubaiunitfinderService.getUserHistory(userId, limit);
  }

  @Post('history')
  @Scopes('dubaiunitfinder:history:create')
  @ApiOperation({ 
    summary: 'Add history entry',
    description: 'Add a new search history entry'
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['userId', 'requestUrl'],
      properties: {
        userId: { type: 'string', example: 'uuid-here' },
        requestUrl: { type: 'string', example: 'https://api.example.com/search' },
        preview: { type: 'string', format: 'binary', description: 'Image data as base64 string' },
        source: { type: 'string', example: 'bayut' },
        location: { type: 'object' },
        coordinates: { type: 'object' },
        rera: { type: 'object' },
        property: { type: 'object' },
        company: { type: 'string', example: 'Agency LLC' },
        buildingName: { type: 'string', example: 'Dubai Marina Tower' },
        unitNumber: { type: 'string', example: '1201' },
        permitNumber: { type: 'string', example: 'PER123456' },
        responseData: { type: 'object' },
        requestStatus: { type: 'string', example: 'success' }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'History entry added successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'History entry added successfully' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid history data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Invalid scope' })
  async addHistoryEntry(
    @Body() historyData: {
      userId: string;
      requestUrl: string;
      preview?: string; // base64 encoded image data
      source?: string;
      location?: any;
      coordinates?: any;
      rera?: any;
      property?: any;
      company?: string;
      buildingName?: string;
      unitNumber?: string;
      permitNumber?: string;
      responseData?: any;
      requestStatus?: string;
    },
    @Headers('x-api-key') apiKey?: string
  ) {
    // TODO: Implement x-api-key validation later
    return this.dubaiunitfinderService.addHistoryEntry(historyData);
  }

  // Admin Endpoints
  @Get('admin/users')
  @Scopes('dubaiunitfinder:admin:users:read')
  @ApiOperation({ 
    summary: 'Get all users (Admin)',
    description: 'Retrieve all users for admin management'
  })
  @ApiQuery({ name: 'page', description: 'Page number', required: false, example: 1 })
  @ApiQuery({ name: 'limit', description: 'Users per page', required: false, example: 50 })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        users: { type: 'array', items: { type: 'object' } },
        total: { type: 'number', example: 150 }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Invalid scope or not admin' })
  async getAllUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Headers('x-api-key') apiKey?: string
  ) {
    // TODO: Implement x-api-key validation later
    return this.dubaiunitfinderService.getAllUsers(page, limit);
  }

  @Get('admin/users/:userId')
  @Scopes('dubaiunitfinder:admin:users:read')
  @ApiOperation({ 
    summary: 'Get user details (Admin)',
    description: 'Retrieve detailed information about a specific user'
  })
  @ApiResponse({
    status: 200,
    description: 'User details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        user: { type: 'object' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Invalid scope or not admin' })
  async getUserDetails(
    @Param('userId') userId: string,
    @Headers('x-api-key') apiKey?: string
  ) {
    // TODO: Implement x-api-key validation later
    return this.dubaiunitfinderService.getUserById(userId);
  }

  // Admin Subscription Management
  @Get('admin/subscriptions')
  @Scopes('dubaiunitfinder:admin:subscriptions:read')
  @ApiOperation({ 
    summary: 'Get all subscriptions (Admin)',
    description: 'Retrieve all subscriptions for all users'
  })
  @ApiQuery({ name: 'page', description: 'Page number', required: false, example: 1 })
  @ApiQuery({ name: 'limit', description: 'Subscriptions per page', required: false, example: 50 })
  @ApiResponse({
    status: 200,
    description: 'Subscriptions retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        subscriptions: { type: 'array', items: { type: 'object' } },
        total: { type: 'number', example: 150 }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Invalid scope or not admin' })
  async getAllSubscriptions(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Headers('x-api-key') apiKey?: string
  ) {
    // TODO: Implement x-api-key validation later
    return this.dubaiunitfinderService.getAllSubscriptions(page, limit);
  }

  @Get('admin/subscriptions/:userId')
  @Scopes('dubaiunitfinder:admin:subscriptions:read')
  @ApiOperation({ 
    summary: 'Get user subscriptions (Admin)',
    description: 'Retrieve all subscriptions for a specific user (admin endpoint)'
  })
  @ApiResponse({
    status: 200,
    description: 'User subscriptions retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        subscriptions: { type: 'array', items: { type: 'object' } }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Invalid scope or not admin' })
  async getUserSubscriptionsAdmin(
    @Param('userId') userId: string,
    @Headers('x-api-key') apiKey?: string
  ) {
    // TODO: Implement x-api-key validation later
    return this.dubaiunitfinderService.getUserSubscriptions(userId);
  }

  // Admin History Management
  @Get('admin/history')
  @Scopes('dubaiunitfinder:admin:history:read')
  @ApiOperation({ 
    summary: 'Get all history (Admin)',
    description: 'Retrieve all history for all users'
  })
  @ApiQuery({ name: 'page', description: 'Page number', required: false, example: 1 })
  @ApiQuery({ name: 'limit', description: 'History entries per page', required: false, example: 50 })
  @ApiResponse({
    status: 200,
    description: 'History retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        history: { type: 'array', items: { type: 'object' } },
        total: { type: 'number', example: 500 }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Invalid scope or not admin' })
  async getAllHistory(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Headers('x-api-key') apiKey?: string
  ) {
    // TODO: Implement x-api-key validation later
    return this.dubaiunitfinderService.getAllHistory(page, limit);
  }

  @Get('admin/history/:userId')
  @Scopes('dubaiunitfinder:admin:history:read')
  @ApiOperation({ 
    summary: 'Get user history (Admin)',
    description: 'Retrieve all history for a specific user (admin endpoint)'
  })
  @ApiQuery({ name: 'limit', description: 'Number of records to return', required: false, example: 50 })
  @ApiResponse({
    status: 200,
    description: 'User history retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        history: { type: 'array', items: { type: 'object' } }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Invalid scope or not admin' })
  async getUserHistoryAdmin(
    @Param('userId') userId: string,
    @Query('limit') limit?: number,
    @Headers('x-api-key') apiKey?: string
  ) {
    // TODO: Implement x-api-key validation later
    return this.dubaiunitfinderService.getUserHistory(userId, limit);
  }

  // Admin User Management
  @Post('admin/users/:userId/status')
  @Scopes('dubaiunitfinder:admin:users:update')
  @ApiOperation({ 
    summary: 'Update user status (Admin)',
    description: 'Update user admin or active status'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        isAdmin: { type: 'boolean', example: true },
        isActive: { type: 'boolean', example: false }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'User status updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'User status updated successfully' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid update data' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Invalid scope or not admin' })
  async updateUserStatus(
    @Param('userId') userId: string,
    @Body() updates: { isAdmin?: boolean; isActive?: boolean },
    @Headers('x-api-key') apiKey?: string
  ) {
    // TODO: Implement x-api-key validation later
    return this.dubaiunitfinderService.updateUserStatus(userId, updates);
  }

  @Post('admin/users/:userId/subscription')
  @Scopes('dubaiunitfinder:admin:subscriptions:create')
  @ApiOperation({ 
    summary: 'Add subscription to user (Admin)',
    description: 'Manually add a subscription to a specific user'
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['packageName', 'requestsInPackage', 'expiryDate'],
      properties: {
        packageName: { type: 'string', example: 'premium' },
        requestsInPackage: { type: 'number', example: 1000 },
        expiryDate: { type: 'string', format: 'date', example: '2024-12-31' },
        price: { type: 'number', example: 99.99 }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Subscription added to user successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Subscription added to user successfully' },
        subscriptionId: { type: 'string', example: 'uuid-here' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid subscription data' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Invalid scope or not admin' })
  async addSubscriptionToUser(
    @Param('userId') userId: string,
    @Body() subscriptionData: {
      packageName: string;
      requestsInPackage: number;
      expiryDate: string;
      price?: number;
    },
    @Headers('x-api-key') apiKey?: string
  ) {
    // TODO: Implement x-api-key validation later
    const expiryDate = new Date(subscriptionData.expiryDate);
    return this.dubaiunitfinderService.addSubscriptionToUser({
      userId,
      ...subscriptionData,
      expiryDate
    });
  }
}