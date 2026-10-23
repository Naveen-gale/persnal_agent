import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config, validateConfig } from './config/env.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import integrationRoutes from './routes/integrationRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import agentRoutes from './routes/agentRoutes.js';

validateConfig();

export const app = express();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // allow frontend assets
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration supporting credentials across Vercel and Render origins
const allowedOrigins = [
  config.frontendUrl,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in dev, or check allowedOrigins
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Request body parsers
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// Rate limit general API requests
app.use('/api/', apiLimiter);

// API Route Mounts
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/integrations', integrationRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1', chatRoutes);
app.use('/api/v1/agent', agentRoutes);
app.use('/api/v1', agentRoutes);

// Root health & info ping
app.get('/', (req, res) => {
  res.json({
    name: 'Personal AI Agent Backend API',
    status: 'running',
    version: '1.0.0',
    documentation: '/api/v1/agent/capabilities',
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Centralized error handler
app.use(errorHandler);
