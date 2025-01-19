// src/config/database.js
const mongoose = require('mongoose');
const config = require('./config');

const connectDB = async () => {
  try {
    await mongoose.connect(config.mongodbURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Puedes agregar más opciones de conexión si lo deseas
    });
    console.log('Conexión a MongoDB exitosa');
  } catch (error) {
    console.error('Error al conectar a MongoDB:', error);
    process.exit(1); // Salir en caso de error crítico
  }
};

module.exports = connectDB;