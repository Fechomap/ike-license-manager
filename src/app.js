// src/app.js
require('dotenv').config();
const express = require('express');
const connectDB = require('./config/database');
const apiRoutes = require('./routes/apiRoutes');
const telegramService = require('./services/telegramService');

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conectar a MongoDB
connectDB()
  .then(() => {
    console.log('✅ Conexión exitosa a MongoDB');
  })
  .catch((error) => {
    console.error('❌ Error al conectar a MongoDB:', error);
    process.exit(1);
  });

// Registrar rutas de la API
app.use('/api', apiRoutes);

// Ruta raíz
app.get('/', (req, res) => {
  res.json({ 
    message: 'Bienvenido a ike-license-manager!',
    status: 'active',
    version: '1.0.0'
  });
});

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({ 
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Inicializar servicios
try {
  if (process.env.TELEGRAM_TOKEN) {
    telegramService.init();
    console.log('✅ Servicio de Telegram inicializado');
  } else {
    console.warn('⚠️ TELEGRAM_TOKEN no configurado');
  }
} catch (error) {
  console.error('❌ Error al inicializar el servicio de Telegram:', error);
}

// Iniciar servidor
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${port}`);
});