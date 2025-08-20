import mongoose from 'mongoose';

export async function connectMongo(uri = process.env.MONGODB_URI) {
  if (!uri) {
    console.warn('MONGODB_URI not set; skipping Mongo connection (user playlists persistence disabled).');
    return null;
  }
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  try {
    await mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB || undefined
    });
    console.log('Connected to MongoDB');
    return mongoose.connection;
  } catch (e) {
    console.error('MongoDB connection failed:', e?.message || e);
    return null;
  }
}

export function isMongoConfigured() {
  return !!process.env.MONGODB_URI;
}

export function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}
