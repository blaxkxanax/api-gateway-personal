import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { OAuthService } from '../oauth2/services/oauth.service';
import * as readline from 'readline';
import { createInterface } from 'readline';

async function promptInput(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const oauthService = app.get(OAuthService);

  console.log('Creating admin OAuth client...');
  const name = await promptInput('Enter client name: ');
  const redirectUri = await promptInput('Enter redirect URI (or press enter for http://localhost): ');

  try {
    const client = await oauthService.createClient({
      name,
      redirectUris: [redirectUri || 'http://localhost'],
      allowedScopes: [
        'test:test:test',
      ],
    });

    console.log('Admin OAuth client created successfully:');
    console.log('----------------------------------');
    console.log(`Client ID: ${client.clientId}`);
    console.log(`Client Secret: ${client.clientSecret}`);
    console.log('----------------------------------');
    console.log('IMPORTANT: Save these credentials securely. The client secret will not be shown again.');
  } catch (error) {
    console.error('Failed to create admin OAuth client:', error.message);
  } finally {
    await app.close();
  }
}

bootstrap(); 