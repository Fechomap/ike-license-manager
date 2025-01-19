// src/config/config.js
require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  mongodbURI: process.env.MONGODB_URI,
  telegramToken: process.env.TELEGRAM_TOKEN,
  jwtSecret: process.env.JWT_SECRET,
  emailUser: process.env.EMAIL_USER,
  emailPassword: process.env.EMAIL_PASSWORD,
  adminChatId: process.env.ADMIN_CHAT_ID,
};