import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { decryptTokens, encryptTokens } from '../services/tokenEncryption.js';
import { invokeAgent } from '../services/agentClient.js';
import { config } from '../config/env.js';

const router = express.Router();

// All chat routes require authentication
router.use(requireAuth);

/**
 * GET /conversations or /chat/conversations
 * List all conversations owned by the authenticated user.
 */
router.get(['/conversations', '/chat/conversations'], async (req, res, next) => {
  try {
    const conversations = await Conversation.find({ userId: req.user._id })
      .sort({ lastMessageAt: -1 })
      .limit(50);

    return res.json({ conversations });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /conversations or /chat/conversations
 * Create a new conversation.
 */
router.post(['/conversations', '/chat/conversations'], async (req, res, next) => {
  try {
    const { title } = req.body;
    const conversation = new Conversation({
      userId: req.user._id,
      title: title?.trim() || 'New Chat',
      lastMessageAt: new Date(),
    });
    await conversation.save();

    return res.status(201).json({ conversation });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /conversations/:id or /chat/conversations/:id
 * Get message history for a specific conversation.
 */
router.get(['/conversations/:id', '/chat/conversations/:id'], async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const messages = await Message.find({
      conversationId: conversation._id,
      userId: req.user._id,
    }).sort({ createdAt: 1 });

    return res.json({
      conversation,
      messages: messages.map((m) => ({
        _id: m._id,
        role: m.role,
        sender: m.role,
        content: m.content,
        text: m.content,
        intent: m.intent,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /conversations/:id or /chat/conversations/:id
 * Delete a conversation and its messages.
 */
router.delete(['/conversations/:id', '/chat/conversations/:id'], async (req, res, next) => {
  try {
    const conversation = await Conversation.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    await Message.deleteMany({ conversationId: conversation._id });

    return res.json({ message: 'Conversation deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /chat or /
 * Send a message to the Personal AI Agent.
 */
router.post(['/chat', '/'], async (req, res, next) => {
  try {
    const { message, conversationId } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'A message is required.' });
    }

    const trimmedMessage = message.trim();

    // 1. Resolve or create conversation
    let conversation;
    if (conversationId) {
      conversation = await Conversation.findOne({
        _id: conversationId,
        userId: req.user._id,
      });
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found.' });
      }
    } else {
      // Auto-title from the first few words of the user's prompt
      const autoTitle = trimmedMessage.slice(0, 35) + (trimmedMessage.length > 35 ? '...' : '');
      conversation = new Conversation({
        userId: req.user._id,
        title: autoTitle,
        lastMessageAt: new Date(),
      });
      await conversation.save();
    }

    // 2. Fetch recent conversation history for LangGraph state context
    const recentDbMessages = await Message.find({
      conversationId: conversation._id,
      userId: req.user._id,
    })
      .sort({ createdAt: -1 })
      .limit(10);

    const contextConversation = recentDbMessages
      .reverse()
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    // 3. Decrypt user's Google tokens if connected
    let decryptedGoogleTokens = null;
    if (req.user.googleIntegration && req.user.googleIntegration.connected) {
      try {
        decryptedGoogleTokens = decryptTokens(
          req.user.googleIntegration,
          config.tokenEncryptionKey
        );
        if (decryptedGoogleTokens && typeof decryptedGoogleTokens === 'object') {
          // Provide client details in case token refresh is triggered by python agent
          decryptedGoogleTokens.client_id = config.googleClientId;
          decryptedGoogleTokens.client_secret = config.googleClientSecret;
        }
      } catch (err) {
        console.error('[Token Decryption Error]', err.message);
      }
    }

    // 4. Save user message to database
    const userMsg = new Message({
      conversationId: conversation._id,
      userId: req.user._id,
      role: 'user',
      content: trimmedMessage,
    });
    await userMsg.save();

    // 5. Invoke the Python LangGraph Agent service
    const agentResult = await invokeAgent({
      userInput: trimmedMessage,
      conversation: contextConversation,
      googleTokens: decryptedGoogleTokens,
    });

    // 6. If tokens were refreshed by the agent, re-encrypt and update in MongoDB
    if (agentResult.googleTokens && agentResult.googleTokens.access_token) {
      try {
        const { encryptedData, iv, authTag } = encryptTokens(
          agentResult.googleTokens,
          config.tokenEncryptionKey
        );
        req.user.googleIntegration.encryptedData = encryptedData;
        req.user.googleIntegration.iv = iv;
        req.user.googleIntegration.authTag = authTag;
        await req.user.save();
      } catch (err) {
        console.error('[Token Re-encryption Error]', err.message);
      }
    }

    // 7. Save assistant message to database
    const assistantMsg = new Message({
      conversationId: conversation._id,
      userId: req.user._id,
      role: 'assistant',
      content: agentResult.response,
      intent: agentResult.intent,
    });
    await assistantMsg.save();

    // 8. Update conversation timestamp
    conversation.lastMessageAt = new Date();
    await conversation.save();

    return res.json({
      conversationId: conversation._id.toString(),
      response: agentResult.response,
      reply: agentResult.response,
      intent: agentResult.intent,
      userMessageId: userMsg._id.toString(),
      assistantMessageId: assistantMsg._id.toString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
