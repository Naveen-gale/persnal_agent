import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Menu, Mail, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { MarkdownRenderer } from './MarkdownRenderer.jsx';

export function ChatInterface({
  conversation,
  messages,
  onSendMessage,
  loading,
  onToggleSidebar,
  onOpenGoogleModal,
  onOpenCapabilitiesModal,
}) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  const { googleStatus } = useAuth();
  const isGoogleConnected = !!(googleStatus && googleStatus.connected);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim() || loading) return;
    const msg = inputText.trim();
    setInputText('');
    onSendMessage(msg);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSuggestion = (prompt) => {
    onSendMessage(prompt);
  };

  return (
    <div style={styles.container}>
      {/* Top Navbar */}
      <header style={styles.topBar}>
        <div style={styles.leftNav}>
          <button onClick={onToggleSidebar} style={styles.menuBtn}>
            <Menu size={20} />
          </button>
          <div style={styles.convHeader}>
            <h2 style={styles.chatTitle}>
              {conversation ? conversation.title : 'New Session'}
            </h2>
          </div>
        </div>

        <div style={styles.rightNav}>
          <button
            onClick={onOpenGoogleModal}
            style={{
              ...styles.statusButton,
              borderColor: isGoogleConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.1)',
              backgroundColor: isGoogleConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.04)',
            }}
          >
            {isGoogleConnected ? (
              <>
                <CheckCircle2 size={14} color="#10b981" />
                <span style={{ color: '#10b981' }}>Google Connected</span>
              </>
            ) : (
              <>
                <Mail size={14} color="#94a3b8" />
                <span style={{ color: '#94a3b8' }}>Google (Optional)</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Message History Area */}
      <div style={styles.messageList}>
        {messages.length === 0 ? (
          <div style={styles.welcomeBanner} className="animate-fade-in">
            <div style={styles.welcomeLogo}>
              <Sparkles size={32} color="#3b82f6" />
            </div>
            <h2 style={styles.welcomeTitle}>Personal AI Agent Ready</h2>
            <p style={styles.welcomeDesc}>
              Direct access is active. Chat freely for general assistance, coding, and brainstorming — or optionally connect Google Workspace whenever you want email and contact management.
            </p>

            <div style={styles.suggestionsGrid}>
              <button
                onClick={() => handleSuggestion('Hi! What can you help me with?')}
                style={styles.suggestionCard}
              >
                <div style={styles.sugIcon}><Sparkles size={16} color="#3b82f6" /></div>
                <span>"Hi! What can you help me with?"</span>
              </button>

              <button
                onClick={() => handleSuggestion('Help me brainstorm my tasks and priorities for today')}
                style={styles.suggestionCard}
              >
                <div style={styles.sugIcon}><Bot size={16} color="#10b981" /></div>
                <span>"Help me brainstorm tasks for today"</span>
              </button>

              <button
                onClick={() => handleSuggestion('Summarize my recent unread emails')}
                style={styles.suggestionCard}
              >
                <div style={styles.sugIcon}><Mail size={16} color="#3b82f6" /></div>
                <span>"Summarize my recent unread emails"</span>
              </button>

              <button
                onClick={() => handleSuggestion('What tools and integrations can you access?')}
                style={styles.suggestionCard}
              >
                <div style={styles.sugIcon}><Users size={16} color="#a855f7" /></div>
                <span>"What tools can you access?"</span>
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={index}
                style={{
                  ...styles.messageRow,
                  justifyContent: isUser ? 'flex-end' : 'flex-start',
                }}
                className="animate-fade-in"
              >
                {!isUser && (
                  <div style={styles.botAvatar}>
                    <Bot size={18} color="#3b82f6" />
                  </div>
                )}

                <div
                  style={{
                    ...styles.messageBubble,
                    ...(isUser ? styles.userBubble : styles.assistantBubble),
                  }}
                >
                  <div style={styles.bubbleText}>
                    <MarkdownRenderer content={msg.text} />
                  </div>
                  {msg.createdAt && (
                    <div style={styles.bubbleTime}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>

                {isUser && (
                  <div style={styles.userAvatar}>
                    <User size={18} color="#ffffff" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {loading && (
          <div style={styles.loadingRow} className="animate-fade-in">
            <div style={styles.botAvatar}>
              <Bot size={18} color="#3b82f6" />
            </div>
            <div style={styles.loadingBubble}>
              <div style={styles.typingDot} className="animate-pulse" />
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>Agent is reasoning...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer */}
      <div style={styles.inputArea}>
        <form onSubmit={handleSubmit} style={styles.inputForm}>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything, summarize emails, or search/add contacts..."
            style={styles.textarea}
            rows={1}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || loading}
            style={{
              ...styles.sendBtn,
              opacity: !inputText.trim() || loading ? 0.4 : 1,
            }}
          >
            <Send size={18} />
          </button>
        </form>
        <div style={styles.disclaimer}>
          Personal AI Agent • LangGraph & Groq LLM • AES-256-GCM Secure Cloud State
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#0b0f19',
    position: 'relative',
  },
  topBar: {
    height: '60px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    backgroundColor: '#0f172a',
    flexShrink: 0,
  },
  leftNav: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  menuBtn: {
    background: 'none',
    color: '#94a3b8',
    padding: '6px',
    borderRadius: '6px',
  },
  convHeader: {
    display: 'flex',
    alignItems: 'center',
  },
  chatTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#f8fafc',
    margin: 0,
  },
  rightNav: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  statusButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    border: '1px solid transparent',
    cursor: 'pointer',
  },
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  welcomeBanner: {
    maxWidth: '600px',
    margin: 'auto',
    textAlign: 'center',
    padding: '40px 20px',
  },
  welcomeLogo: {
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '18px',
    border: '1px solid rgba(59, 130, 246, 0.25)',
  },
  welcomeTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: '8px',
  },
  welcomeDesc: {
    fontSize: '14px',
    color: '#94a3b8',
    marginBottom: '28px',
    lineHeight: 1.5,
  },
  suggestionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '10px',
  },
  suggestionCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 14px',
    backgroundColor: '#121827',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    color: '#cbd5e1',
    fontSize: '13px',
    textAlign: 'left',
  },
  sugIcon: {
    padding: '6px',
    borderRadius: '6px',
    backgroundColor: '#0b0f19',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    width: '100%',
  },
  botAvatar: {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    border: '1px solid rgba(59, 130, 246, 0.25)',
  },
  userAvatar: {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    backgroundColor: '#3b82f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: '12px',
    padding: '12px 16px',
    position: 'relative',
    fontSize: '14px',
    lineHeight: 1.5,
  },
  userBubble: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    borderBottomRightRadius: '4px',
  },
  assistantBubble: {
    backgroundColor: '#182234',
    color: '#f1f5f9',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderBottomLeftRadius: '4px',
  },
  bubbleText: {
    wordBreak: 'break-word',
  },
  bubbleTime: {
    fontSize: '10px',
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: '6px',
    textAlign: 'right',
  },
  loadingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  loadingBubble: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: '#182234',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
  },
  typingDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
  },
  inputArea: {
    padding: '16px 20px',
    backgroundColor: '#0f172a',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  inputForm: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#0b0f19',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '12px',
    padding: '6px 10px',
    gap: '8px',
  },
  textarea: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: '#f8fafc',
    padding: '8px 10px',
    fontSize: '14px',
    resize: 'none',
  },
  sendBtn: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    padding: '10px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclaimer: {
    fontSize: '11px',
    color: '#64748b',
    textAlign: 'center',
  },
};
