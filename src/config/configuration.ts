export default () => ({
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 9000,
  database: {
    host: process.env.DATABASE_HOST || '',
    port: process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT, 10) : 5432,
    username: process.env.DATABASE_USER || '',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || '',
  },
  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '',
  },
  app: {
    url: process.env.APP_URL || '',
  },
  elasticsearch: {
    node: process.env.ELASTICSEARCH_NODE || '',
  },
  oauth: {
    clientId: process.env.OAUTH_CLIENT_ID || '',
    clientSecret: process.env.OAUTH_CLIENT_SECRET || '',
    callbackUrl: process.env.OAUTH_CALLBACK_URL || '',
  },
  services: {
    dynamics: {
      token: process.env.DYNAMICS_API_TOKEN || '',
    },
    bitrix24: {
      token: process.env.BITRIX24_API_TOKEN || '',
    },
    jumpcloud: {
      token: process.env.JUMPCLOUD_API_TOKEN || '',
    },
  },
}); 