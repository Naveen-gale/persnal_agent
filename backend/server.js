import { app } from './src/app.js';
import { config } from './src/config/env.js';
import { connectDB, disconnectDB } from './src/config/db.js';

async function startServer() {
  try {
    // Attempt database connection
    await connectDB();
  } catch (err) {
    console.error('[Database Warning] Running without database connection:', err.message);
  }

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`===============================================`);
    console.log(`  Personal AI Agent Backend Service`);
    console.log(`  Environment: ${config.env}`);
    console.log(`  Port:        ${config.port}`);
    console.log(`  Frontend:    ${config.frontendUrl}`);
    console.log(`  Agent URL:   ${config.agentBaseUrl}`);
    console.log(`===============================================`);
  });

  // Graceful shutdown handling
  const shutdown = async () => {
    console.log('\n[Server] Shutting down gracefully...');
    server.close(async () => {
      await disconnectDB();
      console.log('[Server] Closed connections. Exiting process.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
