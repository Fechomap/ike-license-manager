import 'dotenv/config';

export interface AppConfig {
  port: number;
  databaseUrl: string;
  telegramToken: string;
  jwtSecret: string;
  adminChatId: string | undefined;
  adminApiKey: string;
  isProduction: boolean;
  railwayPublicDomain: string | undefined;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable de entorno requerida no definida: ${name}`);
  }
  return value;
}

function getLazyRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.warn(
      `⚠️ Variable de entorno ${name} no definida. Funcionalidades dependientes estarán deshabilitadas.`,
    );
    return '';
  }
  return value;
}

const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: getRequiredEnv('DATABASE_URL'),
  telegramToken: getLazyRequiredEnv('TELEGRAM_TOKEN'),
  jwtSecret: getLazyRequiredEnv('JWT_SECRET'),
  adminChatId: process.env.ADMIN_CHAT_ID,
  adminApiKey: getLazyRequiredEnv('ADMIN_API_KEY'),
  isProduction: process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT_NAME,
  railwayPublicDomain: process.env.RAILWAY_PUBLIC_DOMAIN,
};

export default config;
