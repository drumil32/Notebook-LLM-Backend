import dotenv from 'dotenv';

dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  jwtSecret: string;
  redisUrl: string;
  qdrantUrl: string;
  qdrantApiKey: string;
  openaiApiKey: string;
  googleApiKey: string;
  frontendUrl1: string;
  frontendUrl2: string;
}

const requiredEnvVars = [
  'PORT',
  'NODE_ENV',
  'DATABASE_URL',
  'JWT_SECRET',
  'REDIS_URL',
  'QDRANT_URL',
  'QDRANT_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_API_KEY',
  'FRONTEND_URL1',
  'FRONTEND_URL2'
] as const;

function validateEnvVars(): Config {
  const missingVars: string[] = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missingVars.push(envVar);
    }
  }

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\nPlease check your .env file and ensure all required variables are set.');
    process.exit(1);
  }

  return {
    port: parseInt(process.env.PORT!, 10),
    nodeEnv: process.env.NODE_ENV!,
    databaseUrl: process.env.DATABASE_URL!,
    jwtSecret: process.env.JWT_SECRET!,
    redisUrl: process.env.REDIS_URL!,
    qdrantUrl: process.env.QDRANT_URL!,
    qdrantApiKey: process.env.QDRANT_API_KEY!,
    openaiApiKey: process.env.OPENAI_API_KEY!,
    googleApiKey: process.env.GOOGLE_API_KEY!,
    frontendUrl1: process.env.FRONTEND_URL1!,
    frontendUrl2: process.env.FRONTEND_URL2!
  };
}

export const config = validateEnvVars();