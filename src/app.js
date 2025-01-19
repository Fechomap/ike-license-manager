// src/app.js
require('dotenv').config();
const express = require('express');
const connectDB = require('./config/database');
const apiRoutes = require('./routes/apiRoutes');
const telegramService = require('./services/telegramService'); // Cambia esto

const app = express();
const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// Conectar a MongoDB
connectDB();

// Middlewares
app.use(express.json());

// Registrar rutas de la API
app.use('/api', apiRoutes);

// Ruta raíz
app.get('/', (req, res) => {
  res.send('Bienvenido a ike-license-manager!');
});

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});