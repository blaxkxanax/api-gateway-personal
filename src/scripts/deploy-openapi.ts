import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../app.module';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * Merges generated OpenAPI spec with existing spec while preserving custom properties
 */
function mergeOpenAPISpecs(generated: any, existing: any): any {
  const merged = { ...generated };
  
  // Preserve custom info properties
  if (existing.info) {
    merged.info = {
      ...merged.info,
      ...existing.info,
      // Preserve specific custom properties
      'x-postman-oauth2-client-credentials-in-body': existing.info['x-postman-oauth2-client-credentials-in-body']
    };
  }
  
  // Preserve custom root-level properties
  if (existing['x-logo']) {
    merged['x-logo'] = existing['x-logo'];
  }
  
  if (existing['x-postman-oauth2-client-credentials-in-body']) {
    merged['x-postman-oauth2-client-credentials-in-body'] = existing['x-postman-oauth2-client-credentials-in-body'];
  }
  
  // Preserve servers from existing spec
  if (existing.servers) {
    merged.servers = existing.servers;
  }
  
  // Merge paths while preserving custom properties
  if (existing.paths) {
    merged.paths = merged.paths || {};
    
    // Process each path in the existing spec
    for (const [path, pathItem] of Object.entries(existing.paths)) {
      // Normalize path by removing /v2 prefix to avoid duplicates
      const normalizedPath = path.startsWith('/v2') ? path.substring(3) : path;
      
      if (merged.paths[normalizedPath]) {
        // Path exists in both - merge operations
        merged.paths[normalizedPath] = mergePathItem(merged.paths[normalizedPath], pathItem);
      } else {
        // Path only exists in existing spec - preserve it with normalized path
        merged.paths[normalizedPath] = pathItem;
      }
    }
  }
  
  // Merge components/schemas while preserving custom properties
  if (existing.components) {
    merged.components = merged.components || {};
    
    if (existing.components.schemas) {
      merged.components.schemas = {
        ...merged.components.schemas,
        ...existing.components.schemas
      };
    }
    
    if (existing.components.securitySchemes) {
      merged.components.securitySchemes = {
        ...merged.components.securitySchemes,
        ...existing.components.securitySchemes
      };
    }
    
    if (existing.components.responses) {
      merged.components.responses = {
        ...merged.components.responses,
        ...existing.components.responses
      };
    }
  }
  
  // Add standard HTTP error responses if they don't exist
  merged.components = merged.components || {};
  merged.components.responses = merged.components.responses || {};
  
  const standardResponses = {
    BadRequestError: {
      description: "Bad Request",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              statusCode: { type: "number", example: 400 },
              message: { type: "string", example: "Bad Request" },
              error: { type: "string", example: "Bad Request" }
            }
          }
        }
      }
    },
    UnauthorizedError: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              statusCode: { type: "number", example: 401 },
              message: { type: "string", example: "Unauthorized" },
              error: { type: "string", example: "Unauthorized" }
            }
          }
        }
      }
    },
    ForbiddenError: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              statusCode: { type: "number", example: 403 },
              message: { type: "string", example: "Forbidden" },
              error: { type: "string", example: "Forbidden" }
            }
          }
        }
      }
    },
    NotFoundError: {
      description: "Not Found",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              statusCode: { type: "number", example: 404 },
              message: { type: "string", example: "Not Found" },
              error: { type: "string", example: "Not Found" }
            }
          }
        }
      }
    },
    ConflictError: {
      description: "Conflict",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              statusCode: { type: "number", example: 409 },
              message: { type: "string", example: "Conflict" },
              error: { type: "string", example: "Conflict" }
            }
          }
        }
      }
    },
    InternalServerError: {
      description: "Internal Server Error",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              statusCode: { type: "number", example: 500 },
              message: { type: "string", example: "Internal Server Error" },
              error: { type: "string", example: "Internal Server Error" }
            }
          }
        }
      }
    }
  };
  
  // Add missing standard responses
  for (const [name, response] of Object.entries(standardResponses)) {
    if (!merged.components.responses[name]) {
      merged.components.responses[name] = response;
    }
  }
  
  // Preserve existing security requirements
  if (existing.security) {
    merged.security = existing.security;
  }
  
  return merged;
}

/**
 * Merges path items while preserving custom properties like x-excluded and applying metadata-based exclusions
 */
function mergePathItem(generated: any, existing: any): any {
  const merged = { ...generated };
  
  // Merge each HTTP method
  const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
  
  for (const method of methods) {
    if (existing[method]) {
      if (merged[method]) {
        // Method exists in both - merge while preserving custom properties
        merged[method] = {
          ...merged[method],
          // Preserve x-excluded and other custom properties
          ...(existing[method]['x-excluded'] && { 'x-excluded': true }),
          ...(existing[method]['x-auth-type'] && { 'x-auth-type': existing[method]['x-auth-type'] }),
          ...(existing[method]['x-client-authentication'] && { 'x-client-authentication': existing[method]['x-client-authentication'] }),
          // Preserve custom tags if they exist
          ...(existing[method].tags && { tags: existing[method].tags }),
          // Preserve custom operationId
          ...(existing[method].operationId && { operationId: existing[method].operationId }),
          // Preserve custom security requirements
          ...(existing[method].security && { security: existing[method].security }),
          // Preserve custom summary/description if they're different
          ...(existing[method].summary && existing[method].summary !== merged[method].summary && { summary: existing[method].summary }),
          ...(existing[method].description && existing[method].description !== merged[method].description && { description: existing[method].description })
        };
      } else {
        // Method only exists in existing spec - preserve it
        merged[method] = existing[method];
      }
    }
    
    // Apply metadata-based exclusions from @ApiExcluded decorator
    if (merged[method] && shouldExcludeEndpoint(merged[method])) {
      merged[method]['x-excluded'] = true;
    }
  }
  
  return merged;
}

/**
 * Helper function to determine if an endpoint should be excluded based on metadata
 */
function shouldExcludeEndpoint(methodDef: any): boolean {
  // Check if endpoint has ApiExcluded decorator metadata
  // This is a simplified check - in a real implementation, you would need to 
  // access the actual controller metadata during the merge process
  return false; // For now, we'll rely on the existing openapi.json x-excluded properties
}

function runCommand(command: string, description: string, cwd?: string): void {
  try {
    console.log(`🔄 ${description}...`);
    const options = cwd ? { cwd, stdio: 'inherit' as const } : { stdio: 'inherit' as const };
    execSync(command, options);
    console.log(`✅ ${description} completed`);
  } catch (error) {
    console.error(`❌ Failed to ${description.toLowerCase()}: ${error.message}`);
    process.exit(1);
  }
}

async function deployOpenAPI() {
  console.log('🚀 Starting OpenAPI deployment pipeline...\n');
  
  // Step 1: Generate OpenAPI specification
  console.log('📝 Step 1: Generating OpenAPI specification');
  const app = await NestFactory.create(AppModule);
  
  const config = new DocumentBuilder()
    .setTitle('API Gateway')
    .setDescription('API Gateway with OAuth2.0 Client Credentials Flow')
    .setVersion('2.0.0')
    .addBearerAuth()
    .addServer('https://api.provident.ae/v2', 'Production server')
    .addServer('https://api.noxum.dev/v2', 'Development server')
    .addServer('http://localhost:9000', 'Local development')
    .addTag('oAuth2', 'OAuth2.0 authentication endpoints')
    .addTag('oauth2-clients', 'OAuth2.0 client management endpoints')
    .addTag('oauth2-tokens', 'OAuth2.0 token management endpoints')
    .addTag('health', 'Health check endpoints')
    .addTag('portal', 'Portal application endpoints')
    .addTag('Dynamics', 'Dynamics integration endpoints')
    .addTag('Bitrix', 'Bitrix24 CRM endpoints')
    .addTag('JumpCloud', 'JumpCloud integration endpoints')
    .addTag('GenieMap', 'GenieMap integration endpoints')
    .addTag('Eventbrite', 'Eventbrite integration endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  // Load existing openapi.json file
  const openApiPath = path.join(__dirname, '..', '..', 'openapi.json');
  let existingSpec = {};
  
  if (fs.existsSync(openApiPath)) {
    try {
      const existingContent = fs.readFileSync(openApiPath, 'utf8');
      existingSpec = JSON.parse(existingContent);
      console.log('✅ Loaded existing OpenAPI specification');
    } catch (error) {
      console.error('⚠️ Error loading existing OpenAPI specification:', error);
    }
  }

  // Merge the generated document with existing spec
  const mergedDocument = mergeOpenAPISpecs(document, existingSpec);
  
  // Write the merged document back to the file
  try {
    fs.writeFileSync(openApiPath, JSON.stringify(mergedDocument, null, 2));
    console.log('✅ OpenAPI specification updated successfully');
    console.log(`✅ Generated ${Object.keys(mergedDocument.paths || {}).length} endpoints`);
    console.log(`✅ Generated ${Object.keys(mergedDocument.components?.schemas || {}).length} schemas`);
  } catch (error) {
    console.error('❌ Error writing OpenAPI specification:', error);
    process.exit(1);
  }

  await app.close().catch((error) => {
    // TypeORM shutdown error is expected and doesn't affect the generation
    if (error.message.includes('DataSource element')) {
      console.log('ℹ️ TypeORM shutdown completed (expected warning)');
    } else {
      console.error('⚠️ Warning during app shutdown:', error.message);
    }
  });
  
  // Step 2: Copy to Mint directory
  console.log('\n📁 Step 2: Copying to Mint documentation');
  const mintPath = '/home/ubuntu/docker/prov_apps/mintlify/api-reference/openapi.json';
  try {
    fs.copyFileSync(openApiPath, mintPath);
    console.log('✅ OpenAPI file copied to Mint directory');
  } catch (error) {
    console.error('❌ Error copying file to Mint directory:', error);
    process.exit(1);
  }
  
  // Step 3: Git operations
  console.log('\n🔄 Step 3: Git operations');
  const mintDir = '/home/ubuntu/docker/prov_apps/mintlify';
  
  // Check git status first
  try {
    const gitStatus = execSync('git status --porcelain', { cwd: mintDir, encoding: 'utf8' });
    if (!gitStatus.trim()) {
      console.log('ℹ️ No changes detected in Mint repository');
      console.log('🎉 Deployment completed - no git operations needed');
      return;
    }
  } catch (error) {
    console.error('❌ Error checking git status:', error);
    process.exit(1);
  }
  
  // Generate commit message with timestamp and endpoint count
  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const commitMessage = `docs: update OpenAPI spec - ${Object.keys(mergedDocument.paths || {}).length} endpoints (${timestamp})`;
  
  // Run git commands
  runCommand('git add api-reference/openapi.json', 'Adding OpenAPI file to git', mintDir);
  runCommand(`git commit -m "${commitMessage}"`, 'Committing changes', mintDir);
  runCommand('git push origin main', 'Pushing to remote repository', mintDir);
  
  console.log('\n🎉 OpenAPI deployment pipeline completed successfully!');
  console.log('📖 Documentation will be updated automatically on the Mint server');
}

deployOpenAPI().catch((error) => {
  console.error('💥 Deployment failed:', error);
  process.exit(1);
}); 