// src/scripts/deleteDatabase.js
require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config/config');
const Token = require('../models/tokenModel');

async function deleteDatabase() {
  try {
    console.log('🔄 Conectando a MongoDB...');

    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(config.mongodbURI);
      console.log('✅ Conectado a MongoDB');
    }

    // Primero, obtener estadísticas de la colección
    const count = await Token.countDocuments();
    console.log(`📊 Tokens encontrados en la base de datos: ${count}`);

    // Solicitar confirmación antes de eliminar
    console.log('\n⚠️ ¡ADVERTENCIA! ⚠️');
    console.log('Estás a punto de eliminar TODOS los tokens de la base de datos.');
    console.log('Esta acción NO SE PUEDE DESHACER.');

    // Usar readline para solicitar confirmación
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    readline.question(
      '\n¿Estás seguro de que quieres eliminar toda la base de datos? (escribe "SI" para confirmar): ',
      async (answer) => {
        if (answer.toUpperCase() === 'SI') {
          console.log('\n🗑️ Eliminando todos los tokens...');

          // Eliminar todos los documentos de la colección
          const result = await Token.deleteMany({});

          console.log(
            `✅ Eliminación completada. ${result.deletedCount} tokens han sido eliminados.`,
          );
        } else {
          console.log('\n❌ Operación cancelada. No se ha eliminado ningún token.');
        }

        readline.close();
        await mongoose.connection.close();
        console.log('🔌 Conexión a MongoDB cerrada');
        process.exit(0);
      },
    );
  } catch (error) {
    console.error('❌ Error al eliminar la base de datos:', error);
    await mongoose.connection.close();
    console.log('🔌 Conexión a MongoDB cerrada');
    process.exit(1);
  }
}

// Ejecutar la función
deleteDatabase();
