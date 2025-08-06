# OpenAPI Auto-Generation Setup

This project has been configured to automatically generate OpenAPI specifications from NestJS decorators while preserving custom properties from the existing `openapi.json` file.

## Features

- **Auto-generation**: Generates OpenAPI specs from NestJS controllers and DTOs
- **Preserves customizations**: Maintains existing custom properties like `x-excluded`, `x-logo`, custom tags, etc.
- **Merges intelligently**: Combines generated specs with existing file without overwriting customizations
- **Path normalization**: Automatically handles URL prefix differences to avoid duplicates
- **Supports exclusions**: Easily exclude endpoints from documentation

## How It Works

1. **During server startup**: The application automatically generates and merges the OpenAPI specification
2. **Manual generation**: Run `npm run generate:openapi` to generate without starting the server
3. **Intelligent merging**: The system preserves:
   - Custom properties like `x-excluded`, `x-logo`
   - Custom server configurations
   - Custom tags and descriptions
   - Custom security requirements
   - Custom operation IDs
4. **Path normalization**: Automatically strips `/v2` prefixes from existing paths to match generated paths and avoid duplicates

## Path Handling

The system intelligently handles URL structure:
- **Server URLs**: Include `/v2` (e.g., `https://api.provident.ae/v2`)
- **Generated paths**: Use clean paths (e.g., `/health`, `/oauth2/token`)
- **Final URLs**: Combine correctly (e.g., `https://api.provident.ae/v2/health`)
- **Legacy handling**: Old `/v2/health` paths are normalized to `/health` during merging

## Usage

### Automated Deployment Pipeline (Recommended)

The easiest way to update your documentation is with the automated deployment pipeline:

```bash
npm run deploy:openapi
```

This single command will:
1. ✅ Generate the OpenAPI specification from your NestJS code
2. ✅ Merge with existing customizations (preserving `x-excluded`, etc.)
3. ✅ Copy the file to the Mint documentation directory
4. ✅ Add, commit, and push changes to git with a descriptive message
5. ✅ Trigger automatic documentation refresh on the Mint server

**Example output:**
```
🚀 Starting OpenAPI deployment pipeline...

📝 Step 1: Generating OpenAPI specification
✅ Loaded existing OpenAPI specification
✅ OpenAPI specification updated successfully
✅ Generated 55 endpoints
✅ Generated 50 schemas

📁 Step 2: Copying to Mint documentation
✅ OpenAPI file copied to Mint directory

🔄 Step 3: Git operations
🔄 Adding OpenAPI file to git...
✅ Adding OpenAPI file to git completed
🔄 Committing changes...
✅ Committing changes completed
🔄 Pushing to remote repository...
✅ Pushing to remote repository completed

🎉 OpenAPI deployment pipeline completed successfully!
📖 Documentation will be updated automatically on the Mint server
```

### Running the Application

When you start the application normally, it will automatically:
1. Generate OpenAPI spec from your NestJS decorators
2. Load the existing `openapi.json` file
3. Merge the two while preserving customizations
4. Write the merged result back to `openapi.json`
5. Serve the documentation at `/api`

```bash
npm run start:dev
```

### Manual Generation Only

To generate the OpenAPI specification without deployment:

```bash
npm run generate:openapi
```

### Excluding Endpoints

To exclude endpoints from the OpenAPI documentation, use the `@ApiExcluded()` decorator:

```typescript
import { ApiExcluded } from '../decorators/api-excluded.decorator';

@ApiExcluded() // This endpoint will not appear in the OpenAPI docs
@Post('internal/admin-only')
async adminOnlyEndpoint() {
  // ... implementation
}
```

### Adding Custom Properties

You can add custom properties to the existing `openapi.json` file, and they will be preserved:

```json
{
  "paths": {
    "/oauth2/token": {
      "post": {
        "x-excluded": true,
        "x-auth-type": "OAuth 2.0",
        "x-client-authentication": "body"
      }
    }
  }
}
```

## File Structure

- `src/main.ts` - Contains the main OpenAPI generation and merging logic
- `src/scripts/generate-openapi.ts` - Standalone script for generating OpenAPI specs
- `src/scripts/deploy-openapi.ts` - Complete deployment pipeline (generate + copy + git)
- `src/decorators/api-excluded.decorator.ts` - Decorator for excluding endpoints
- `openapi.json` - The main OpenAPI specification file (auto-updated)

## Configuration

The OpenAPI generation is configured in `src/main.ts` with:

```typescript
const config = new DocumentBuilder()
  .setTitle('API Gateway')
  .setDescription('API Gateway with OAuth2.0 Client Credentials Flow')
  .setVersion('2.0.0')
  .addBearerAuth()
  .addServer('https://api.provident.ae/v2', 'Production server')
  .addServer('https://api.noxum.dev/v2', 'Development server')
  .addServer('http://localhost:9000', 'Local development')
  // ... tags and other configuration
  .build();
```

## Integration with Mint

The generated `openapi.json` file is designed to work seamlessly with Mint for documentation display. All custom properties required by Mint are preserved during the generation process.

## Best Practices

1. **Use proper decorators**: Ensure all controllers and DTOs have appropriate `@ApiTags`, `@ApiOperation`, `@ApiProperty`, etc.
2. **Document DTOs**: Add `@ApiProperty` decorators to all DTO properties for proper schema generation
3. **Custom properties**: Add custom properties to the existing `openapi.json` file rather than hardcoding them
4. **Use the deployment pipeline**: Use `npm run deploy:openapi` for production updates to automatically deploy to documentation
5. **Test locally first**: Use `npm run generate:openapi` to test changes locally before deploying

### When to Use Which Script

- **`npm run deploy:openapi`** - Use when you want to update the live documentation (production workflow)
- **`npm run generate:openapi`** - Use for local testing and development
- **`npm run start:dev`** - Updates the local file automatically during development

## Troubleshooting

### Generation Issues

If the OpenAPI generation fails:
1. Check that all DTOs have proper decorators
2. Ensure no circular dependencies in your modules
3. Verify that the `openapi.json` file is valid JSON

### Missing Endpoints

If endpoints are missing from the generated spec:
1. Ensure the controller is properly imported in a module
2. Check that the endpoint has appropriate decorators
3. Verify the endpoint is not marked with `@ApiExcluded()`

### Custom Properties Not Preserved

If custom properties are lost:
1. Check that the property name is supported in the merging logic
2. Ensure the JSON structure matches what the merger expects
3. Add support for new custom properties in the `mergePathItem` function

## Development

To modify the generation logic:
1. Edit `src/main.ts` for runtime generation
2. Edit `src/scripts/generate-openapi.ts` for standalone generation
3. Both files share the same merging functions for consistency 