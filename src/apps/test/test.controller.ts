import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { TestService } from './test.service';
import { OAuthGuard } from '../../oauth2/guards/oauth.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';

@ApiTags('test')
@Controller('apps/test')
@UseGuards(OAuthGuard)
@ApiBearerAuth()
export class TestController {
  constructor(private readonly testService: TestService) {}

  @Get()
  @Scopes('test:test:test')
  @ApiOperation({ 
    summary: 'Test endpoint',
    description: 'A simple test endpoint that requires test:test:test scope and returns success true'
  })
  @ApiResponse({
    status: 200,
    description: 'Success response',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: true
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Invalid scope' })
  getTest() {
    return this.testService.getTestResult();
  }
}