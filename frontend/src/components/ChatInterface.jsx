import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Menu, Mail, Users, CheckCircle2, AlertCircle, Cpu, PlusCircle, Search, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { MarkdownRenderer } from './MarkdownRenderer.jsx';
import { ComposeEmailModal } from './ComposeEmailModal.jsx';
import { PhotosGalleryModal } from './PhotosGalleryModal.jsx';

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
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [isPhotosModalOpen, setIsPhotosModalOpen] = useState(false);
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
          <button onClick={onToggleSidebar} style={styles.menuBtn} title="Toggle Sidebar">
            <Menu size={20} />
          </button>
          <div style={styles.convHeader}>
            <h2 style={styles.chatTitle}>
              {conversation ? conversation.title : 'New Session'}
            </h2>
            <div style={styles.nluPill}>
              <Sparkles size={11} color="#60a5fa" />
              <span>NLU Active</span>
            </div>
          </div>
        </div>

        <div style={styles.rightNav}>
          {/* Quick Compose Email Action */}
          <button
            onClick={() => setIsComposeModalOpen(true)}
            style={styles.composeHeaderBtn}
            title="Compose and send an email via Gmail"
          >
            <Mail size={14} color="#38bdf8" />
            <span>Compose Email</span>
          </button>

          {/* Google Photos & ImageKit Gallery Action */}
          <button
            onClick={() => setIsPhotosModalOpen(true)}
            style={styles.photosHeaderBtn}
            title="View Google Photos stored in ImageKit"
          >
            <ImageIcon size={14} color="#ec4899" />
            <span>Photos & ImageKit</span>
          </button>

          {/* Capabilities Modal Trigger */}
          <button
            onClick={onOpenCapabilitiesModal}
            style={styles.capabilitiesHeaderBtn}
            title="View Agent Capabilities & Tools"
          >
            <Cpu size={14} color="#94a3b8" />
            <span>Capabilities</span>
          </button>

          {/* Google Integration Status */}
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
                <span style={{ color: '#94a3b8' }}>Connect Google</span>
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
              Natural Language Understanding is fully enabled. You can speak naturally without rigid keyword formats — ask questions, send real Gmail messages, look up contacts, or summarize your inbox in plain English.
            </p>

            <div style={styles.suggestionsGrid}>
              <button
                onClick={() => handleSuggestion('Send an email to alex@example.com saying let\'s sync tomorrow at 3pm')}
                style={styles.suggestionCard}
              >
                <div style={styles.sugIcon}><Mail size={16} color="#38bdf8" /></div>
                <div>
                  <div style={styles.sugTitle}>Send Gmail</div>
                  <span style={styles.sugPrompt}>"Send an email to alex@example.com saying let's sync at 3pm"</span>
                </div>
              </button>

              <button
                onClick={() => handleSuggestion('Summarize my recent unread emails and highlight any action items')}
                style={styles.suggestionCard}
              >
                <div style={styles.sugIcon}><Mail size={16} color="#10b981" /></div>
                <div>
                  <div style={styles.sugTitle}>Summarize Emails</div>
                  <span style={styles.sugPrompt}>"Summarize my recent unread emails and highlight action items"</span>
                </div>
              </button>

              <button
                onClick={() => handleSuggestion('Look up Naveen in my contacts and show his phone and email')}
                style={styles.suggestionCard}
              >
                <div style={styles.sugIcon}><Users size={16} color="#a855f7" /></div>
                <div>
                  <div style={styles.sugTitle}>Find Contact</div>
                  <span style={styles.sugPrompt}>"Look up Naveen in my contacts and show phone and email"</span>
                </div>
              </button>

              <button
                onClick={() => handleSuggestion('Add a new contact named Maria with phone 9876543210 and email maria@gmail.com')}
                style={styles.suggestionCard}
              >
                <div style={styles.sugIcon}><PlusCircle size={16} color="#f59e0b" /></div>
                <div>
                  <div style={styles.sugTitle}>Add Contact</div>
                  <span style={styles.sugPrompt}>"Add Maria with phone 9876543210 and email maria@gmail.com"</span>
                </div>
              </button>

              <button
                onClick={() => handleSuggestion('Find all emails from Google about security updates')}
                style={styles.suggestionCard}
              >
                <div style={styles.sugIcon}><Search size={16} color="#ec4899" /></div>
                <div>
                  <div style={styles.sugTitle}>Search Gmail</div>
                  <span style={styles.sugPrompt}>"Find all emails from Google about security updates"</span>
                </div>
              </button>

              <button
                onClick={() => handleSuggestion('Hi! What all can you help me with?')}
                style={styles.suggestionCard}
              >
                <div style={styles.sugIcon}><Sparkles size={16} color="#3b82f6" /></div>
                <div>
                  <div style={styles.sugTitle}>Explore Assistant</div>
                  <span style={styles.sugPrompt}>"Hi! What all can you help me with?"</span>
                </div>
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
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>Agent is reasoning & orchestrating tools...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer */}
      <div style={styles.inputArea}>
        {/* Quick Action Chips */}
        <div style={styles.quickChipsRow}>
          <button
            type="button"
            onClick={() => setIsComposeModalOpen(true)}
            style={styles.chipBtn}
          >
            <Mail size={12} color="#38bdf8" />
            <span>Compose Email</span>
          </button>
          <button
            type="button"
            onClick={() => handleSuggestion('Show my recent emails from my inbox')}
            style={styles.chipBtn}
          >
            <Mail size={12} color="#10b981" />
            <span>Latest Emails</span>
          </button>
          <button
            type="button"
            onClick={() => handleSuggestion('Show all my contacts')}
            style={styles.chipBtn}
          >
            <Users size={12} color="#a855f7" />
            <span>My Contacts</span>
          </button>
          <button
            type="button"
            onClick={() => setIsPhotosModalOpen(true)}
            style={styles.chipBtn}
          >
            <ImageIcon size={12} color="#ec4899" />
            <span>Google Photos (ImageKit)</span>
          </button>
          <button
            type="button"
            onClick={onOpenCapabilitiesModal}
            style={styles.chipBtn}
          >
            <Cpu size={12} color="#64748b" />
            <span>Agent Capabilities</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.inputForm}>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type naturally... e.g. 'send gmail to alex@example.com saying...', 'show my photos', 'check unread emails'"
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
            title="Send Message"
          >
            <Send size={18} />
          </button>
        </form>
        <div style={styles.disclaimer}>
          Personal AI Agent • Natural Language Understanding • Gmail Sending • Google Photos on ImageKit CDN
        </div>
      </div>

      {/* Compose Email Modal */}
      <ComposeEmailModal
        isOpen={isComposeModalOpen}
        onClose={() => setIsComposeModalOpen(false)}
        onSendEmail={onSendMessage}
      />

      {/* Google Photos & ImageKit Gallery Modal */}
      <PhotosGalleryModal
        isOpen={isPhotosModalOpen}
        onClose={() => setIsPhotosModalOpen(false)}
      />
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
    border: 'none',
    color: '#94a3b8',
    padding: '6px',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  convHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  chatTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#f8fafc',
    margin: 0,
  },
  nluPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    border: '1px solid rgba(59, 130, 246, 0.25)',
    borderRadius: '12px',
    fontSize: '10px',
    fontWeight: '600',
    color: '#93c5fd',
  },
  rightNav: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  composeHeaderBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    color: '#38bdf8',
    border: '1px solid rgba(56, 189, 248, 0.25)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  photosHeaderBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    backgroundColor: 'rgba(236, 72, 153, 0.12)',
    color: '#ec4899',
    border: '1px solid rgba(236, 72, 153, 0.25)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  capabilitiesHeaderBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '500',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    color: '#cbd5e1',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    cursor: 'pointer',
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
    maxWidth: '680px',
    margin: 'auto',
    textAlign: 'center',
    padding: '36px 16px',
  },
  welcomeLogo: {
    width: '60px',
    height: '60px',
    borderRadius: '16px',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
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
    marginBottom: '26px',
    lineHeight: 1.5,
  },
  suggestionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '12px',
  },
  suggestionCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px 14px',
    backgroundColor: '#121827',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    color: '#cbd5e1',
    fontSize: '13px',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  sugIcon: {
    padding: '8px',
    borderRadius: '8px',
    backgroundColor: '#0b0f19',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: '2px',
  },
  sugTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: '2px',
  },
  sugPrompt: {
    fontSize: '12px',
    color: '#94a3b8',
    lineHeight: 1.4,
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
    backgroundColor: '#2563eb',
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
    padding: '14px 20px',
    backgroundColor: '#0f172a',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  quickChipsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '2px',
  },
  chipBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '5px 10px',
    backgroundColor: '#121827',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '500',
    color: '#cbd5e1',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
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
    outline: 'none',
  },
  sendBtn: {
    backgroundColor: '#3b82f6',
    border: 'none',
    color: '#ffffff',
    padding: '10px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  disclaimer: {
    fontSize: '11px',
    color: '#64748b',
    textAlign: 'center',
  },
};
