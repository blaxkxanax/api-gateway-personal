import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to exclude an endpoint from OpenAPI documentation
 * This will add x-excluded: true to the endpoint in the merged OpenAPI spec
 */
export const API_EXCLUDED_KEY = 'api-excluded';

export function ApiExcluded() {
  return SetMetadata(API_EXCLUDED_KEY, true);
} 