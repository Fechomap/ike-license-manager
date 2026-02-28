import mongoose from 'mongoose';

import config from './config';

const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(config.mongodbURI);
    console.log('✅ Conexion exitosa a MongoDB');
  } catch (error) {
    console.error('❌ Error al conectar a MongoDB:', error);
    process.exit(1);
  }
};

export default connectDB;
