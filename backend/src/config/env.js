import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend folder or root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Auto-detect public backend host (Render injects RENDER_EXTERNAL_URL)
const renderUrl = process.env.RENDER_EXTERNAL_URL
  || (process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : null);

const backendPublicUrl = process.env.BACKEND_PUBLIC_URL
  || renderUrl
  || 'http://localhost:3000';

let resolvedGoogleRedirectUri = process.env.GOOGLE_REDIRECT_URI;
if (!resolvedGoogleRedirectUri || (renderUrl && resolvedGoogleRedirectUri.includes('localhost'))) {
  resolvedGoogleRedirectUri = `${backendPublicUrl.replace(/\/+$/, '')}/api/v1/integrations/google/callback`;
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  backendPublicUrl,

  // MongoDB configuration
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/personal_agent',
  mongodbDbName: process.env.MONGODB_DB_NAME || 'personal_agent',

  // Authentication & session security
  jwtSecret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production_min32chars',
  cookieName: process.env.COOKIE_NAME || 'agent_token',
  sessionMaxAgeMs: parseInt(process.env.SESSION_MAX_AGE_MS || String(7 * 24 * 60 * 60 * 1000), 10), // 7 days default

  // Google OAuth credentials
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri: resolvedGoogleRedirectUri,

  // Google token encryption key (32 bytes / 256 bits for AES-256-GCM)
  tokenEncryptionKey: process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || 'dev_encryption_key_change_in_production_32b',

  // Python Agent service communication
  agentBaseUrl: process.env.AGENT_BASE_URL || 'http://127.0.0.1:8000',
  agentServiceSecret: process.env.AGENT_SERVICE_SECRET || 'local_dev_agent_secret_32bytes_min',

  // Bootstrap initial admin
  bootstrapAdminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL || '',
  bootstrapAdminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD || '',

  // ImageKit Configuration
  imagekitPublicKey: process.env.IMAGEKIT_PUBLIC_KEY || '',
  imagekitPrivateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
  imagekitUrlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || '',

  logLevel: process.env.LOG_LEVEL || 'info',
};

// Startup validation warnings
export function validateConfig() {
  const missing = [];
  if (config.env === 'production') {
    if (!process.env.MONGODB_URI) missing.push('MONGODB_URI');
    if (!process.env.SESSION_SECRET && !process.env.JWT_SECRET) missing.push('SESSION_SECRET');
    if (!process.env.GOOGLE_TOKEN_ENCRYPTION_KEY) missing.push('GOOGLE_TOKEN_ENCRYPTION_KEY');
    if (!process.env.AGENT_SERVICE_SECRET) missing.push('AGENT_SERVICE_SECRET');
    if (!process.env.GOOGLE_CLIENT_ID) missing.push('GOOGLE_CLIENT_ID');
    if (!process.env.GOOGLE_CLIENT_SECRET) missing.push('GOOGLE_CLIENT_SECRET');
  }

  if (missing.length > 0) {
    console.warn(`[Config Warning] The following production environment variables are unset: ${missing.join(', ')}`);
  }
}
