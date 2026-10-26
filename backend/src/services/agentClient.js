import axios from 'axios';
import { config } from '../config/env.js';

const client = axios.create({
  baseURL: config.agentBaseUrl,
  timeout: 45000, // 45 seconds for LLM generation and Gmail queries
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Invoke the Python LangGraph Agent service with user input and decrypted Google tokens.
 * @param {object} params
 * @param {string} params.userInput
 * @param {Array} params.conversation
 * @param {object|null} params.googleTokens
 * @param {Array} [params.syncedPhotos]
 * @param {Array} [params.syncedContacts]
 * @returns {Promise<{ response: string, intent: string, conversation: Array, googleTokens: object|null }>}
 */
export async function invokeAgent({
  userInput,
  conversation = [],
  googleTokens = null,
  syncedPhotos = [],
  syncedContacts = [],
}) {
  const headers = {};
  if (config.agentServiceSecret) {
    headers['X-Agent-Secret'] = config.agentServiceSecret;
  }

  const payload = {
    user_input: userInput,
    conversation: conversation.slice(-20), // bound context window
    google_tokens: googleTokens,
    synced_photos: (syncedPhotos || []).map((p) => ({
      id: p.googlePhotoId || p._id?.toString(),
      filename: p.filename || 'photo.jpg',
      url: p.imageKitUrl || p.thumbnailUrl,
      thumbnail: p.thumbnailUrl || p.imageKitUrl,
      mimeType: p.mimeType || 'image/jpeg',
      creationTime: p.creationTime ? new Date(p.creationTime).toISOString() : '',
      storage: 'ImageKit CDN',
    })),
    synced_contacts: (syncedContacts || []).map((c) => ({
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
    })),
  };

  try {
    const { data } = await client.post('/invoke', payload, { headers });
    return {
      response: data.response || "I couldn't generate a response. Please try again.",
      intent: data.intent || 'general',
      conversation: data.conversation || [],
      googleTokens: data.google_tokens || null,
    };
  } catch (error) {
    if (error.response) {
      const detail = error.response.data?.detail || error.response.statusText;
      throw new Error(`Agent service error (${error.response.status}): ${detail}`);
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw new Error(
        `Unable to connect to the Python Agent service at ${config.agentBaseUrl}. Please ensure the agent service is running.`
      );
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Agent request timed out. Please try again.');
    }
    throw error;
  }
}

/**
 * Retrieve the status and capabilities reported by the Python agent.
 */
export async function getAgentCapabilities() {
  try {
    const { data } = await client.get('/capabilities');
    return data;
  } catch (error) {
    return {
      status: 'offline',
      error: error.message,
    };
  }
}

/**
 * Check if the Python agent is healthy.
 */
export async function checkAgentHealth() {
  try {
    const { data } = await client.get('/health', { timeout: 5000 });
    return data?.status === 'ok';
  } catch {
    return false;
  }
}
