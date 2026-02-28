// src/scripts/deleteDatabase.ts
import 'dotenv/config';

import * as readline from 'readline';

import mongoose from 'mongoose';

import config from '../config/config';
import Token from '../models/tokenModel';

async function deleteDatabase(): Promise<void> {
  try {
    console.log('Conectando a MongoDB...');

    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(config.mongodbURI);
      console.log('Conectado a MongoDB');
    }

    // Primero, obtener estadisticas de la coleccion
    const count = await Token.countDocuments();
    console.log(`Tokens encontrados en la base de datos: ${count}`);

    // Solicitar confirmacion antes de eliminar
    console.log('\nADVERTENCIA!');
    console.log('Estas a punto de eliminar TODOS los tokens de la base de datos.');
    console.log('Esta accion NO SE PUEDE DESHACER.');

    // Usar readline para solicitar confirmacion
    const rl: readline.Interface = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question(
        '\nEstas seguro de que quieres eliminar toda la base de datos? (escribe "SI" para confirmar): ',
        (input: string) => {
          resolve(input);
        },
      );
    });

    if (answer.toUpperCase() === 'SI') {
      console.log('\nEliminando todos los tokens...');

      // Eliminar todos los documentos de la coleccion
      const result = await Token.deleteMany({});

      console.log(`Eliminacion completada. ${result.deletedCount} tokens han sido eliminados.`);
    } else {
      console.log('\nOperacion cancelada. No se ha eliminado ningun token.');
    }

    rl.close();
    await mongoose.connection.close();
    console.log('Conexion a MongoDB cerrada');
    process.exit(0);
  } catch (error) {
    console.error('Error al eliminar la base de datos:', error);
    await mongoose.connection.close();
    console.log('Conexion a MongoDB cerrada');
    process.exit(1);
  }
}

void deleteDatabase();
