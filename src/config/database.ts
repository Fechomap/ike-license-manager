import prisma from '../lib/prisma';

const connectDB = async (): Promise<void> => {
  try {
    await prisma.$connect();
    // Fail-fast: verificar que la conexion permite queries reales
    await prisma.$queryRawUnsafe('SELECT 1');
    console.log('✅ Conexion exitosa a PostgreSQL');
  } catch (error) {
    console.error('❌ Error al conectar a PostgreSQL:', error);
    process.exit(1);
  }
};

export const disconnectDB = async (): Promise<void> => {
  await prisma.$disconnect();
};

export default connectDB;
