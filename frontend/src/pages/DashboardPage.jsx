import React, { useState, useEffect, useCallback } from 'react';
import { ConversationSidebar } from '../components/ConversationSidebar.jsx';
import { ChatInterface } from '../components/ChatInterface.jsx';
import { GoogleIntegrationModal } from '../components/GoogleIntegrationModal.jsx';
import { CapabilitiesModal } from '../components/CapabilitiesModal.jsx';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export function DashboardPage() {
  const { refreshGoogleStatus } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [isCapabilitiesModalOpen, setIsCapabilitiesModalOpen] = useState(false);

  // Check URL params for OAuth callbacks
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected') === 'true') {
      refreshGoogleStatus();
      setIsGoogleModalOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('google_error')) {
      alert(`Google Connection Notice: ${params.get('google_error')}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [refreshGoogleStatus]);

  // Load conversation list
  const loadConversations = useCallback(async () => {
    try {
      const list = await api.getConversations();
      setConversations(list);
      return list;
    } catch (err) {
      console.error('Failed to load conversations', err);
      return [];
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load single conversation
  const handleSelectConversation = async (id) => {
    setActiveId(id);
    try {
      const data = await api.getConversation(id);
      const conv = data.conversation || data;
      setActiveConversation(conv);
      const formatted = (data.messages || []).map((m) => ({
        sender: m.role || m.sender || 'assistant',
        text: m.content || m.text || '',
        createdAt: m.createdAt,
      }));
      setMessages(formatted);
    } catch (err) {
      console.error('Failed to load conversation details', err);
    }
  };

  const handleNewConversation = () => {
    setActiveId(null);
    setActiveConversation(null);
    setMessages([]);
  };

  const handleDeleteConversation = async (id) => {
    try {
      await api.deleteConversation(id);
      if (activeId === id) {
        handleNewConversation();
      }
      loadConversations();
    } catch (err) {
      alert(err.message || 'Failed to delete conversation');
    }
  };

  const handleSendMessage = async (text) => {
    const tempUserMsg = {
      sender: 'user',
      text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      const res = await api.sendMessage(activeId, text);
      const replyText = res.reply || res.response || "I didn't receive a response from the agent.";
      const agentMsg = {
        sender: 'assistant',
        text: replyText,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, agentMsg]);

      // If this was a new conversation, update activeId and reload list
      if (!activeId && res.conversationId) {
        setActiveId(res.conversationId);
      }
      loadConversations();
    } catch (err) {
      const errorMsg = {
        sender: 'assistant',
        text: `Error: ${err.message || 'Unable to communicate with agent service.'}`,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <ConversationSidebar
        conversations={conversations}
        activeId={activeId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onOpenGoogleModal={() => setIsGoogleModalOpen(true)}
        onOpenCapabilitiesModal={() => setIsCapabilitiesModalOpen(true)}
        isOpenMobile={isSidebarOpenMobile}
        onCloseMobile={() => setIsSidebarOpenMobile(false)}
      />

      <ChatInterface
        conversation={activeConversation}
        messages={messages}
        onSendMessage={handleSendMessage}
        loading={loading}
        onToggleSidebar={() => setIsSidebarOpenMobile((prev) => !prev)}
        onOpenGoogleModal={() => setIsGoogleModalOpen(true)}
        onOpenCapabilitiesModal={() => setIsCapabilitiesModalOpen(true)}
      />

      <GoogleIntegrationModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
      />

      <CapabilitiesModal
        isOpen={isCapabilitiesModalOpen}
        onClose={() => setIsCapabilitiesModalOpen(false)}
      />
    </div>
  );
}
