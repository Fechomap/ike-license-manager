// src/config/config.js
require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  mongodbURI: process.env.MONGODB_URI,
  telegramToken: process.env.TELEGRAM_TOKEN,
  jwtSecret: process.env.JWT_SECRET,
  adminChatId: process.env.ADMIN_CHAT_ID,
  isProduction: process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT_NAME,
  railwayPublicDomain: process.env.RAILWAY_PUBLIC_DOMAIN,
};