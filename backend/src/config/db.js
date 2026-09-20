import mongoose from 'mongoose';
import env from './env.js';

let isConnected = false;

export const connectDB = async () => {
  if (isConnected) {
    console.log('[Database] Using existing MongoDB connection');
    return;
  }

  try {
    const conn = await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    isConnected = true;
    console.log(`[Database] MongoDB connected: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);
  } catch (error) {
    console.error(`[Database Error] Connection failed: ${error.message}`);
    // In production we would exit, in dev we want to allow inspection
    if (env.NODE_ENV === 'production') {
      process.exit(1);
    }
    throw error;
  }
};

export const checkDBHealth = () => {
  return mongoose.connection.readyState === 1;
};

export default connectDB;
