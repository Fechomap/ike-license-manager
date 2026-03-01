// src/scripts/deleteDatabase.ts
import 'dotenv/config';

import * as readline from 'readline';

import prisma from '../lib/prisma';

async function deleteDatabase(): Promise<void> {
  try {
    console.log('Conectando a PostgreSQL...');

    // Primero, obtener estadisticas de la tabla
    const count = await prisma.token.count();
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

      // Eliminar todos los registros de la tabla
      const result = await prisma.token.deleteMany({});

      console.log(`Eliminacion completada. ${result.count} tokens han sido eliminados.`);
    } else {
      console.log('\nOperacion cancelada. No se ha eliminado ningun token.');
    }

    rl.close();
    await prisma.$disconnect();
    console.log('Conexion a PostgreSQL cerrada');
    process.exit(0);
  } catch (error) {
    console.error('Error al eliminar la base de datos:', error);
    await prisma.$disconnect();
    console.log('Conexion a PostgreSQL cerrada');
    process.exit(1);
  }
}

void deleteDatabase();
