const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = localStorage.getItem('agent_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // sends HTTP-only session cookie
  });

  const contentType = response.headers.get('content-type');
  let data = null;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = (data && data.error) || (data && data.message) || response.statusText || 'Request failed';
    throw new ApiError(errorMsg, response.status, data);
  }

  return data;
}

export const api = {
  // Authentication
  async register(email, password, name) {
    const res = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    if (res.token) {
      localStorage.setItem('agent_token', res.token);
    }
    return res;
  },

  async login(email, password) {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.token) {
      localStorage.setItem('agent_token', res.token);
    }
    return res;
  },

  async logout() {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      localStorage.removeItem('agent_token');
    }
  },

  async getMe() {
    return await request('/auth/me');
  },

  // Conversations
  async getConversations() {
    const res = await request('/chat/conversations');
    return res.conversations || [];
  },

  async getConversation(id) {
    const res = await request(`/chat/conversations/${id}`);
    return res;
  },

  async deleteConversation(id) {
    return await request(`/chat/conversations/${id}`, { method: 'DELETE' });
  },

  async sendMessage(conversationId, message) {
    return await request('/chat', {
      method: 'POST',
      body: JSON.stringify({ conversationId, message }),
    });
  },

  // Google Integration
  async getGoogleStatus() {
    const res = await request('/integrations/google/status');
    return res.integration || res;
  },

  async getGoogleConnectUrl() {
    const res = await request('/integrations/google/connect');
    return res.authUrl;
  },

  async disconnectGoogle() {
    return await request('/integrations/google/disconnect', { method: 'POST' });
  },

  async getSyncJobStatus() {
    const res = await request('/integrations/google/sync-status');
    return res.syncJob;
  },

  async resyncAllGoogleData() {
    return await request('/integrations/google/resync', { method: 'POST' });
  },

  // Agent Capabilities
  async getCapabilities() {
    const res = await request('/agent/capabilities');
    return res.capabilities;
  },

  // Photos & ImageKit
  async getPhotos(page = 1, limit = 50) {
    return await request(`/photos?page=${page}&limit=${limit}`);
  },

  async syncPhotos(pageSize = 500) {
    return await request('/photos/sync', {
      method: 'POST',
      body: JSON.stringify({ pageSize }),
    });
  },

  async getPhotoSyncProgress() {
    return await request('/photos/sync-progress');
  },

  async createPhotosPickerSession() {
    return await request('/photos/picker/session', {
      method: 'POST',
    });
  },

  async completePhotosPickerSync(sessionId) {
    return await request('/photos/picker/complete', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  },

  async uploadPhotoDirect(fileBase64, fileName, mimeType) {
    return await request('/photos/upload-direct', {
      method: 'POST',
      body: JSON.stringify({ fileBase64, fileName, mimeType }),
    });
  },

  // Synced Contacts (MongoDB)
  async getContacts(page = 1, limit = 100, search = '') {
    const q = search ? `&search=${encodeURIComponent(search)}` : '';
    return await request(`/contacts?page=${page}&limit=${limit}${q}`);
  },

  async syncContacts() {
    return await request('/contacts/sync', {
      method: 'POST',
    });
  },

  // Synced Gmail (MongoDB)
  async getEmails(page = 1, limit = 50, search = '') {
    const q = search ? `&search=${encodeURIComponent(search)}` : '';
    return await request(`/emails?page=${page}&limit=${limit}${q}`);
  },

  async syncEmails(maxMessages = 100) {
    return await request('/emails/sync', {
      method: 'POST',
      body: JSON.stringify({ maxMessages }),
    });
  },

  // Synced Google Drive Files (MongoDB)
  async getDriveFiles(page = 1, limit = 50, search = '') {
    const q = search ? `&search=${encodeURIComponent(search)}` : '';
    return await request(`/drive?page=${page}&limit=${limit}${q}`);
  },

  async syncDriveFiles(maxFiles = 100) {
    return await request('/drive/sync', {
      method: 'POST',
      body: JSON.stringify({ maxFiles }),
    });
  },
};

