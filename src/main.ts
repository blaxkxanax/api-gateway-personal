import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston/dist/winston.utilities';
// import { ElasticsearchTransport } from 'winston-elasticsearch';
import * as cookieParser from 'cookie-parser';
import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  // Create Winston logger configuration
  const logger = WinstonModule.createLogger({
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.ms(),
          nestWinstonModuleUtilities.format.nestLike('API Gateway', {
            prettyPrint: true,
          }),
        ),
      }),
      // ELK STACK DISABLED - ElasticsearchTransport commented out
      /*
      new ElasticsearchTransport({
        level: 'info',
        clientOpts: {
          node: process.env.ELASTICSEARCH_NODE || '',
          auth: {
            username: process.env.ELASTIC_USERNAME || '',
            password: process.env.ELASTIC_PASSWORD || ''
          },
          maxRetries: 5,
          requestTimeout: 60000,
          tls: {
            rejectUnauthorized: false
          }
        },
        indexPrefix: 'api-gateway-logs',
        indexTemplate: {
          name: 'api-gateway-logs-template',
          body: {
            index_patterns: ["api-gateway-logs-*"],
            priority: 1,
            template: {
              settings: {
                number_of_shards: 1,
                number_of_replicas: 1
              },
              mappings: {
                dynamic: true,
                dynamic_templates: [
                  {
                    strings_as_keywords: {
                      match_mapping_type: "string",
                      mapping: {
                        type: "keyword"
                      }
                    }
                  }
                ],
                properties: {
                  "@timestamp": { type: "date" },
                  "severity": { type: "keyword" },
                  "message": { type: "text" },
                  // Request fields
                  "req_type": { type: "keyword" },
                  "req_id": { type: "keyword" },
                  "req_method": { type: "keyword" },
                  "req_url": { type: "keyword" },
                  "req_path": { type: "keyword" },
                  "req_fullUrl": { type: "keyword" },
                  "req_ip": { type: "ip" },
                  "req_realIp": { type: "ip" },
                  "req_forwardedIp": { type: "keyword" },
                  "req_cfRay": { type: "keyword" },
                  "req_cfIpCountry": { type: "keyword" },
                  "req_userAgent": { type: "keyword" },
                  "req_body": { type: "keyword" },
                  "req_authType": { type: "keyword" },
                  "req_authToken": { type: "keyword" },
                  "req_tokenClientId": { type: "keyword" },
                  "req_tokenUserId": { type: "keyword" },
                  "req_tokenSubject": { type: "keyword" },
                  "req_tokenScopes": { type: "keyword" },
                  "req_tokenExpiry": { type: "date" },
                  "req_clientId": { type: "keyword" },
                  // Response fields
                  "res_type": { type: "keyword" },
                  "res_id": { type: "keyword" },
                  "res_method": { type: "keyword" },
                  "res_url": { type: "keyword" },
                  "res_path": { type: "keyword" },
                  "res_fullUrl": { type: "keyword" },
                  "res_ip": { type: "ip" },
                  "res_forwardedIp": { type: "keyword" },
                  "res_userAgent": { type: "keyword" },
                  "res_statusCode": { type: "integer" },
                  "res_responseTime": { type: "integer" },
                  "res_responseSize": { type: "keyword" },
                  "res_responseBody": { type: "keyword" },
                  "res_authType": { type: "keyword" },
                  "res_authToken": { type: "keyword" },
                  "res_tokenClientId": { type: "keyword" },
                  "res_tokenUserId": { type: "keyword" },
                  "res_tokenSubject": { type: "keyword" },
                  "res_tokenScopes": { type: "keyword" },
                  "res_tokenExpiry": { type: "date" },
                  "res_clientId": { type: "keyword" },
                  // Validated token object
                  "validatedToken": {
                    type: "object",
                    properties: {
                      "id": { type: "keyword" },
                      "accessToken": { type: "keyword" },
                      "refreshToken": { type: "keyword" },
                      "scopes": { type: "keyword" },
                      "expiresAt": { type: "date" },
                      "refreshTokenExpiresAt": { type: "date" },
                      "createdAt": { type: "date" },
                      "clientId": { type: "keyword" },
                      "userId": { type: "keyword" },
                      "revoked": { type: "boolean" },
                      "client": {
                        type: "object",
                        properties: {
                          "id": { type: "keyword" },
                          "clientId": { type: "keyword" },
                          "name": { type: "keyword" },
                          "isActive": { type: "boolean" },
                          "createdAt": { type: "date" },
                          "updatedAt": { type: "date" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        transformer: (logData) => {
          try {
            // Start with base log data
            const transformedData: Record<string, any> = {
              '@timestamp': new Date().toISOString(),
              severity: logData.level,
              message: logData.message
            };

            // Handle metadata and context
            if (logData.meta) {
              // If meta is a string (shouldn't happen but let's handle it)
              if (typeof logData.meta === 'string') {
                transformedData.meta = logData.meta;
                // --- DEBUG LOG START ---
                // console.log('[DEBUG] Transformed Log Data (meta=string):', JSON.stringify(transformedData, null, 2));
                // --- DEBUG LOG END ---
                return transformedData;
              }

              // Parse context if it's a string
              let contextData = logData.meta.context;
              if (typeof contextData === 'string') {
                try {
                  contextData = JSON.parse(contextData);
                } catch (e) {
                  // If parsing fails, use as is
                  contextData = logData.meta.context;
                }
              }

              // Add context data directly to root
              if (contextData && typeof contextData === 'object') {
                Object.entries(contextData).forEach(([key, value]) => {
                  // Handle arrays and objects
                  if (Array.isArray(value)) {
                    transformedData[key] = JSON.stringify(value);
                  } else if (value !== null && typeof value === 'object') {
                    // For validatedToken, keep it as an object
                    if (key === 'validatedToken') {
                      transformedData[key] = value;
                    } else {
                      transformedData[key] = JSON.stringify(value);
                    }
                  } else if (value === undefined) {
                    transformedData[key] = '';
                  } else {
                    transformedData[key] = value;
                  }
                });
              }

              // Add any non-context metadata at root level
              Object.entries(logData.meta).forEach(([key, value]) => {
                if (key !== 'context') {
                  // Don't process if it's not an object or array
                  if (value !== null && typeof value === 'object') {
                    transformedData[key] = JSON.stringify(value);
                  } else if (value !== undefined) {
                    transformedData[key] = value;
                  }
                }
              });
            }

            // --- DEBUG LOG START ---
            // console.log('[DEBUG] Transformed Log Data:', JSON.stringify(transformedData, null, 2));
            // --- DEBUG LOG END ---
            
            return transformedData;
          } catch (error) {
            // If there's an error processing the log data, return a simplified version
            return {
              '@timestamp': new Date().toISOString(),
              severity: 'error',
              message: logData.message || 'Error processing log data',
              error: error.message,
              original_message: typeof logData === 'object' ? JSON.stringify(logData) : String(logData)
            };
          }
        }
      }),
      */
    ],
  });

  // Specify NestExpressApplication adapter
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    {
      logger: logger,
    }
  );

  // Enable trust proxy
  app.set('trust proxy', true);

  // Add request logging middleware
  app.use((req, res, next) => {
    // Generate a unique request ID
    const requestId = crypto.randomUUID();
    req['requestId'] = requestId;
    
    // Start timing
    const startTime = Date.now();
    
    // Define type-safe logging fields
    interface LogData {
      requestId: string;
      method: string;
      url: string;
      path: string;
      fullUrl: string;
      ip: string;
      forwardedIp: string | unknown;
      userAgent: string;
      referer: string;
      contentType: string;
      authType?: string;
      authToken?: string;
      tokenSubject?: string;
      tokenClientId?: string;
      tokenUserId?: string;
      tokenScopes?: string[] | string;
      tokenExpiry?: string;
      queryParams?: string;
      requestBody?: string;
      clientId?: string;
      redirectUri?: string;
      validatedToken?: any;
    }
    
    // Basic request info
    const logData: LogData = {
      requestId,
      method: req.method,
      url: req.url,
      path: req.path,
      fullUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      forwardedIp: req.headers['x-forwarded-for'] || 'none',
      userAgent: req.get('user-agent') || 'unknown',
      referer: req.get('referer') || 'none',
      contentType: req.get('content-type') || 'none',
    };
    
    // Add auth token info
    if (req.headers.authorization) {
      const authParts = req.headers.authorization.toString().split(' ');
      if (authParts.length > 1 && authParts[0].toLowerCase() === 'bearer') {
        logData.authType = 'Bearer';
        logData.authToken = authParts[1];
        
        // Try to decode JWT
        try {
          const tokenParts = authParts[1].split('.');
          if (tokenParts.length === 3) {
            const tokenPayload = JSON.parse(
              Buffer.from(tokenParts[1], 'base64').toString()
            );
            
            // Extract important token data
            if (tokenPayload) {
              logData.tokenSubject = tokenPayload.sub || 'unknown';
              logData.tokenClientId = tokenPayload.client_id || 'unknown';
              logData.tokenUserId = tokenPayload.userId || tokenPayload.user_id || 'unknown';
              logData.tokenScopes = tokenPayload.scope || [];
              logData.tokenExpiry = tokenPayload.exp 
                ? new Date(tokenPayload.exp * 1000).toISOString() 
                : 'unknown';
            }
          }
        } catch (e) {
          // JWT parsing failed, continue
        }
      }
    }
    
    // Helper function to extract token information
    const extractTokenInfo = (token: string) => {
      if (!token) return;
      
      try {
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const tokenPayload = JSON.parse(
            Buffer.from(tokenParts[1], 'base64').toString()
          );
          
          if (tokenPayload) {
            // Only update if not already set from authorization header
            logData.tokenSubject = logData.tokenSubject || tokenPayload.sub || 'unknown';
            logData.tokenClientId = logData.tokenClientId || tokenPayload.client_id || 'unknown';
            logData.tokenUserId = logData.tokenUserId || tokenPayload.userId || tokenPayload.user_id || 'unknown';
            logData.tokenScopes = logData.tokenScopes || tokenPayload.scope || [];
            logData.tokenExpiry = logData.tokenExpiry || (tokenPayload.exp 
              ? new Date(tokenPayload.exp * 1000).toISOString() 
              : 'unknown');
          }
        }
      } catch (e) {
        // JWT parsing failed, continue
      }
    };
    
    // Add query params
    if (Object.keys(req.query).length > 0) {
      logData.queryParams = JSON.stringify(req.query);
    }
    
    // Add sanitized body content
    if (req.body && req.method !== 'GET') {
      // Make a sanitized copy
      const sanitizedBody = { ...req.body };
      
      // Remove sensitive values
      ['password', 'token', 'secret', 'apiKey'].forEach(field => {
        if (sanitizedBody[field]) sanitizedBody[field] = '********';
      });
      
      logData.requestBody = JSON.stringify(sanitizedBody);
      
      // Extract client info for OAuth endpoints
      if (req.url.includes('/oauth') || req.url.includes('/auth')) {
        if (req.body.client_id) logData.clientId = req.body.client_id;
        if (req.body.redirect_uri) logData.redirectUri = req.body.redirect_uri;
        // Extract token from introspect/revoke endpoints to get client information
        if ((req.url.includes('/introspect') || req.url.includes('/revoke')) && req.body.token) {
          try {
            // Store the token for further processing
            logData.authToken = logData.authToken || req.body.token;
            // Extract information from the token in the request body
            extractTokenInfo(req.body.token);
          } catch (e) {
            // Token extraction failed, continue
          }
        }
      }
    }
    
    // Add a method to update token info after validation
    req['updateValidatedTokenInfo'] = (validatedToken: any) => {
      if (validatedToken) {
        logData.validatedToken = validatedToken;
        // Update token information with validated data
        logData.tokenClientId = validatedToken.client?.clientId || validatedToken.clientId || logData.tokenClientId;
        logData.tokenUserId = validatedToken.userId || logData.tokenUserId;
        logData.tokenScopes = validatedToken.scopes || logData.tokenScopes;
        logData.tokenExpiry = validatedToken.expiresAt ? new Date(validatedToken.expiresAt).toISOString() : logData.tokenExpiry;
        
        // If we have client information, update that as well
        if (validatedToken.client) {
          logData.clientId = validatedToken.client.clientId;
        }
      }
    };

    // Store logData in request for later access
    req['logData'] = logData;
    
    // Track response
    const originalEnd = res.end;
    const chunks: Buffer[] = [];
    const originalWrite = res.write;
    
    // Capture response chunks
    res.write = function(chunk, ...args) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
      }
      return originalWrite.apply(res, arguments);
    };
    
    // Override end to log response info
    res.end = function(...args) {
      // Calculate response time
      const responseTime = Date.now() - startTime;
      
      // Capture final chunk if present
      if (args[0]) {
        chunks.push(Buffer.isBuffer(args[0]) ? args[0] : Buffer.from(args[0] as string));
      }
      
      // Try to parse response body if possible
      let responseBody = '';
      try {
        // Only attempt to parse if we have chunks
        if (chunks.length > 0) {
          const bodyBuffer = Buffer.concat(chunks);
          const contentType = String(res.getHeader('content-type') || '');
          
          // Handle PDF responses with pre-calculated hash
          if (contentType.includes('application/pdf') && req['pdfResponseHash']) {
            responseBody = `[PDF file generated, size: ${req['pdfResponseSize']} bytes, sha256: ${req['pdfResponseHash']}]`;
          }
          // Handle JSON and text-based responses
          else if (contentType.includes('application/json')) {
            const bodyStr = bodyBuffer.toString('utf8');
            if (bodyStr.length < 10000) {
              try {
                responseBody = JSON.stringify(JSON.parse(bodyStr));
              } catch (e) {
                responseBody = bodyStr.substring(0, 1000) + (bodyStr.length > 1000 ? '...[truncated]' : '');
              }
            } else {
              responseBody = `[Large JSON response: ${bodyStr.length} bytes]`;
            }
          } else if (contentType.includes('text')) {
            const bodyStr = bodyBuffer.toString('utf8');
            responseBody = bodyStr.substring(0, 1000) + (bodyStr.length > 1000 ? '...[truncated]' : '');
          } 
          // Handle other PDF responses (fallback)
          else if (contentType.includes('application/pdf')) {
            const hash = crypto.createHash('sha256').update(bodyBuffer).digest('hex');
            responseBody = `[PDF file generated, size: ${bodyBuffer.length} bytes, sha256: ${hash}]`;
          }
          // Fallback for any other binary content
          else {
            responseBody = `[Binary data: ${bodyBuffer.length} bytes, content-type: ${contentType}]`;
          }
        }
      } catch (e) {
        responseBody = '[Error capturing response body]';
      }
      
      // Get the final state of logData which should include validated token info
      const finalLogData = req['logData'];
      
      // Log response with complete data including any validated token info
      const logResponseData = {
        context: {
          res_type: 'response',
          res_id: requestId,
          res_method: req.method,
          res_url: req.url,
          res_path: req.path,
          res_fullUrl: finalLogData.fullUrl,
          res_ip: finalLogData.ip,
          res_forwardedIp: finalLogData.forwardedIp,
          res_userAgent: finalLogData.userAgent,
          res_statusCode: res.statusCode,
          res_responseTime: responseTime,
          res_responseSize: res.getHeader('content-length') || chunks.length || 'unknown',
          res_responseBody: responseBody,
          // Include all token information that may have been validated during the request
          res_authType: finalLogData.authType || '',
          res_authToken: finalLogData.authToken || '',
          res_tokenClientId: finalLogData.tokenClientId || '',
          res_tokenUserId: finalLogData.tokenUserId || '',
          res_tokenSubject: finalLogData.tokenSubject || '',
          res_tokenScopes: typeof finalLogData.tokenScopes === 'object' ? JSON.stringify(finalLogData.tokenScopes) : (finalLogData.tokenScopes || ''),
          res_tokenExpiry: finalLogData.tokenExpiry || '',
          res_clientId: finalLogData.clientId || '',
          // Include the full validated token if available
          validatedToken: finalLogData.validatedToken || null
        }
      };
      
      // Select appropriate log level based on status code but don't include the message in the log
      // since it's already in the context
      if (res.statusCode >= 500) {
        Logger.error('', logResponseData);
        // --- SEND ATTEMPT LOG START ---
        // console.log(`[DEBUG] Attempted to send ERROR log for request ${requestId} to Elasticsearch.`);
        // --- SEND ATTEMPT LOG END ---
      } else if (res.statusCode >= 400) {
        Logger.warn('', logResponseData);
        // --- SEND ATTEMPT LOG START ---
        // console.log(`[DEBUG] Attempted to send WARN log for request ${requestId} to Elasticsearch.`);
        // --- SEND ATTEMPT LOG END ---
      } else {
        Logger.log('', logResponseData);
        // --- SEND ATTEMPT LOG START ---
        // console.log(`[DEBUG] Attempted to send INFO log for request ${requestId} to Elasticsearch.`);
        // --- SEND ATTEMPT LOG END ---
      }
      
      // Complete the response
      return originalEnd.apply(res, args);
    };
    
    next();
  });

  // Swagger documentation setup (do this before setting global prefix)
  const config = new DocumentBuilder()
    .setTitle('API Gateway')
    .setDescription('API Gateway with OAuth2.0 Client Credentials Flow')
    .setVersion('2.0.0')
    .addBearerAuth()
    .addServer('http://localhost:9000/v2', 'Production server')
    .addServer('http://localhost:9000/v2', 'Development server')
    .addServer('http://localhost:9000', 'Local development')
    .addTag('oAuth2', 'OAuth2.0 authentication endpoints')
    .addTag('oauth2-clients', 'OAuth2.0 client management endpoints')
    .addTag('oauth2-tokens', 'OAuth2.0 token management endpoints')
    .addTag('health', 'Health check endpoints')
    .addTag('noxum', 'Noxum data endpoints for properties, floorplans, and owners')
    .addTag('dubaiunitfinder', 'Dubai Unit Finder platform endpoints for user management, subscriptions, and history')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  // Load existing openapi.json file
  const openApiPath = path.join(__dirname, '..', 'openapi.json');
  let existingSpec = {};
  
  if (fs.existsSync(openApiPath)) {
    try {
      const existingContent = fs.readFileSync(openApiPath, 'utf8');
      existingSpec = JSON.parse(existingContent);
      console.log('Loaded existing OpenAPI specification');
    } catch (error) {
      console.error('Error loading existing OpenAPI specification:', error);
    }
  }

  // Merge the generated document with existing spec
  const mergedDocument = mergeOpenAPISpecs(document, existingSpec);
  
  // Write the merged document back to the file
  try {
    fs.writeFileSync(openApiPath, JSON.stringify(mergedDocument, null, 2));
    console.log('OpenAPI specification updated successfully');
  } catch (error) {
    console.error('Error writing OpenAPI specification:', error);
  }

  // Set global prefix AFTER generating OpenAPI docs to avoid double /v2
  app.setGlobalPrefix('v2');

  // Enable cookie parsing
  app.use(cookieParser());

  // Enable CORS with credentials
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Uncomment this to view on localhost:9000/api endpoint in browser
  // SwaggerModule.setup('api', app, mergedDocument);

  // Start the application
  const port = process.env.PORT || 9000;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
}

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

bootstrap();
