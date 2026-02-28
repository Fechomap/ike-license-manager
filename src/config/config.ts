import 'dotenv/config';

export interface AppConfig {
  port: number;
  mongodbURI: string;
  telegramToken: string;
  jwtSecret: string | undefined;
  adminChatId: string | undefined;
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

const config: AppConfig = {
  port: parseInt(process.env.PORT || '3500', 10),
  mongodbURI: getRequiredEnv('MONGODB_URI'),
  telegramToken: getRequiredEnv('TELEGRAM_TOKEN'),
  jwtSecret: process.env.JWT_SECRET,
  adminChatId: process.env.ADMIN_CHAT_ID,
  isProduction: process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT_NAME,
  railwayPublicDomain: process.env.RAILWAY_PUBLIC_DOMAIN,
};

export default config;
