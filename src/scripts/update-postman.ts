
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { execSync } from 'child_process';
import configuration from '../config/configuration';

// Create a minimal module to only load the configuration
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
  ],
})
class ScriptModule {}

async function updatePostman() {
  // Bootstrap a minimal NestJS application to access the ConfigService
  const app = await NestFactory.createApplicationContext(ScriptModule, {
    logger: false, // Suppress NestJS logging
  });
  const configService = app.get(ConfigService);

  const postmanEnv = configService.get<string>('POSTMAN_ENV', 'development');
  const apiKey = postmanEnv === 'development'
    ? configService.get<string>('DEV_POSTMAN_API_KEY')
    : configService.get<string>('POSTMAN_API_KEY');
  const collectionId = postmanEnv === 'development'
    ? configService.get<string>('DEV_POSTMAN_COLLECTION_ID')
    : configService.get<string>('POSTMAN_COLLECTION_ID');

  if (!apiKey || !collectionId) {
    console.error('✗ Postman API Key or Collection ID is not configured for the environment:', postmanEnv);
    await app.close();
    process.exit(1);
  }

  const openApiPath = path.join(__dirname, '..', '..', 'openapi.json');
  const tempPostmanFile = path.join(__dirname, 'temp-postman-collection.json');

  try {
    console.log(`› Attempting to update Postman collection for [${postmanEnv}] environment...`);

    // Step 1: Convert openapi.json to a Postman collection file using the external tool
    console.log(`› [1/3] Converting OpenAPI spec at ${openApiPath}...`);
    execSync(`npx openapi-to-postmanv2 -s "${openApiPath}" -o "${tempPostmanFile}" -p`);
    console.log(`✓ [1/3] Conversion successful. Temporary file created at ${tempPostmanFile}`);

    // Step 2: Read the converted file and wrap it for the Postman API
    console.log('› [2/3] Preparing collection data for update...');
    const postmanJson = JSON.parse(fs.readFileSync(tempPostmanFile, 'utf8'));
    
    const collectionPayload = {
      collection: {
        info: {
          name: (postmanJson.info?.name || 'API Gateway') +(postmanEnv === 'development' ? ' - Dev' : ''),
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          description: postmanJson.info?.description || ''
        },
        item: postmanJson.item || []
      }
    };
    console.log('✓ [2/3] Collection data prepared.');

    // Step 3: Update the target Postman collection
    console.log(`› [3/3] Updating target Postman collection [${collectionId}]...`);
    const updateUrl = `https://api.getpostman.com/collections/${collectionId}`;
    
    await axios.put(updateUrl, collectionPayload, {
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    console.log(`\n✨ All done! Postman collection updated successfully!`);
    console.log(`✓ View it at: https://go.postman.co/collection/${collectionId}`);

  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error(`✗ A Postman API error occurred: ${error.response.status} ${error.response.statusText}`);
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('✗ An unexpected error occurred:', error);
    }
    process.exit(1);
  } finally {
    // Clean up the temporary file
    if (fs.existsSync(tempPostmanFile)) {
      fs.unlinkSync(tempPostmanFile);
      console.log('✓ Temporary file cleaned up.');
    }
    await app.close();
  }
}

updatePostman().catch(console.error); 