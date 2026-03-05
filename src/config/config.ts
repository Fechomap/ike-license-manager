import 'dotenv/config';

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  oauthClientId: string;
  oauthTenantId: string;
  oauthClientSecret: string;
}

export interface AppConfig {
  port: number;
  databaseUrl: string;
  telegramToken: string;
  jwtSecret: string;
  adminChatId: string | undefined;
  adminApiKey: string;
  isProduction: boolean;
  railwayPublicDomain: string | undefined;
  smtp: SmtpConfig;
  softwareDownloadUrl: string;
  bankAccountInfo: string;
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
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    fromEmail: process.env.SMTP_FROM_EMAIL || 'automike@havanitechnologies.com',
    fromName: process.env.SMTP_FROM_NAME || 'Havani',
    oauthClientId: process.env.OAUTH_CLIENT_ID || '',
    oauthTenantId: process.env.OAUTH_TENANT_ID || '',
    oauthClientSecret: process.env.OAUTH_CLIENT_SECRET || '',
  },
  softwareDownloadUrl: process.env.SOFTWARE_DOWNLOAD_URL || '',
  bankAccountInfo: process.env.BANK_ACCOUNT_INFO || '',
};

export default config;
