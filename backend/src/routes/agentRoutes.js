import express from 'express';
import { getAgentCapabilities, checkAgentHealth } from '../services/agentClient.js';
import { isDbConnected } from '../config/db.js';

const router = express.Router();


/**
 * GET /api/v1/health
 * Public service health check.
 */
router.get('/health', async (req, res) => {
  const agentOk = await checkAgentHealth();
  const dbOk = isDbConnected();

  const isHealthy = dbOk && agentOk;

  return res.status(isHealthy ? 200 : 200).json({
    status: isHealthy ? 'healthy' : 'degraded',
    services: {
      backend: 'ok',
      database: dbOk ? 'connected' : 'disconnected',
      agent: agentOk ? 'connected' : 'unreachable',
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/v1/agent/capabilities
 * Returns tool and model capabilities reported by the Python agent.
 */
router.get('/agent/capabilities', async (req, res) => {
  const capabilities = await getAgentCapabilities();
  return res.json(capabilities);
});

export default router;
