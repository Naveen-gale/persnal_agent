import dns from 'dns';
import mongoose from 'mongoose';
import { config } from './env.js';

// Resolve MongoDB Atlas SRV records reliably on Windows/ISP networks by using Google & Cloudflare DNS
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (dnsErr) {
  console.warn('[DNS Warning] Could not set custom DNS servers:', dnsErr.message);
}

let isConnected = false;

export async function connectDB() {
  if (isConnected) {
    return;
  }

  try {
    const conn = await mongoose.connect(config.mongodbUri, {
      dbName: config.mongodbDbName,
      serverSelectionTimeoutMS: 15000,
    });

    isConnected = true;
    console.log(`[MongoDB] Connected to database: ${conn.connection.name}`);

    // Drop any legacy unique index (google_sub_1) that causes duplicate null errors for new users
    try {
      const userColl = conn.connection.collection('users');
      const indexes = await userColl.indexes();
      const hasGoogleSub = indexes.some((idx) => idx.name === 'google_sub_1');
      if (hasGoogleSub) {
        await userColl.dropIndex('google_sub_1');
        console.log('[MongoDB] Cleaned up legacy index: google_sub_1');
      }
    } catch {
      // Ignore if collection or index does not exist
    }
  } catch (error) {
    console.error(`[MongoDB Connection Error] ${error.message}`);
    // Do not crash immediately in dev mode so API can still report status
    if (config.env === 'production') {
      throw error;
    }
  }
}

export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

export async function disconnectDB() {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
  }
}
