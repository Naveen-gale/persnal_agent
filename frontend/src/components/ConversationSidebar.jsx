import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { MessageSquare, Plus, Trash2, Bot, LogOut, CheckCircle2, AlertCircle, Cpu, Mail } from 'lucide-react';

export function ConversationSidebar({
  conversations,
  activeId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onOpenGoogleModal,
  onOpenCapabilitiesModal,
  isOpenMobile,
  onCloseMobile,
}) {
  const { user, logout, googleStatus } = useAuth();
  const isGoogleConnected = !!(googleStatus && googleStatus.connected);

  return (
    <aside style={{
      ...styles.sidebar,
      display: isOpenMobile ? 'flex' : (window.innerWidth <= 768 ? 'none' : 'flex'),
    }}>
      {/* Workspace Brand Header */}
      <div style={styles.header}>
        <div style={styles.brand}>
          <div style={styles.brandIcon}>
            <Bot size={22} color="#3b82f6" />
          </div>
          <div style={styles.brandText}>
            <span style={styles.brandTitle}>Personal AI Agent</span>
            <span style={styles.brandTag}>Production v1.0</span>
          </div>
        </div>

        <button onClick={onNewConversation} style={styles.newChatBtn}>
          <Plus size={16} />
          <span>New Chat</span>
        </button>
      </div>

      {/* Conversations List */}
      <div style={styles.conversationsList}>
        <div style={styles.sectionHeading}>Recent Conversations</div>

        {conversations.length === 0 ? (
          <div style={styles.emptyNotice}>
            <span>No conversations yet. Start a new one!</span>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv._id === activeId;
            return (
              <div
                key={conv._id}
                onClick={() => {
                  onSelectConversation(conv._id);
                  if (onCloseMobile) onCloseMobile();
                }}
                style={{
                  ...styles.convItem,
                  ...(isActive ? styles.convItemActive : {}),
                }}
              >
                <MessageSquare size={16} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.6 }} />
                <span style={styles.convTitle} title={conv.title || 'Untitled Chat'}>
                  {conv.title || 'Untitled Chat'}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Delete this conversation?')) {
                      onDeleteConversation(conv._id);
                    }
                  }}
                  style={styles.deleteBtn}
                  title="Delete conversation"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Integrations & Controls */}
      <div style={styles.integrationsPanel}>
        <button onClick={onOpenGoogleModal} style={styles.toolPillBtn}>
          <div style={styles.pillLeft}>
            <Mail size={16} color={isGoogleConnected ? '#10b981' : '#f59e0b'} />
            <span style={styles.pillLabel}>Google Integration</span>
          </div>
          {isGoogleConnected ? (
            <span style={styles.badgeConnected}>
              <CheckCircle2 size={12} style={{ marginRight: 4 }} />
              Active
            </span>
          ) : (
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
              Optional
            </span>
          )}
        </button>

        <button onClick={onOpenCapabilitiesModal} style={styles.toolPillBtn}>
          <div style={styles.pillLeft}>
            <Cpu size={16} color="#3b82f6" />
            <span style={styles.pillLabel}>Agent Capabilities</span>
          </div>
          <span style={styles.badgeModel}>Groq</span>
        </button>
      </div>

      {/* User Footer */}
      <div style={styles.footer}>
        <div style={styles.userInfo}>
          <div style={styles.userAvatar}>
            {(user && user.name ? user.name[0] : 'U').toUpperCase()}
          </div>
          <div style={styles.userMeta}>
            <span style={styles.userName}>{user ? user.name : 'Galen'}</span>
            <span style={styles.userEmail}>{user ? user.email : ''}</span>
          </div>
        </div>
        <button onClick={logout} style={styles.logoutBtn} title="Sign Out">
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: '280px',
    backgroundColor: '#0f172a',
    borderRight: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    flexShrink: 0,
  },
  header: {
    padding: '18px 16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  brandIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(59, 130, 246, 0.25)',
  },
  brandText: {
    display: 'flex',
    flexDirection: 'column',
  },
  brandTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#f8fafc',
  },
  brandTag: {
    fontSize: '11px',
    color: '#64748b',
    fontWeight: '500',
  },
  newChatBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 14px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
  },
  conversationsList: {
    flex: 1,
    overflowY: 'auto',
    padding: '14px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  sectionHeading: {
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: '#64748b',
    padding: '6px 8px',
    marginBottom: '4px',
  },
  emptyNotice: {
    padding: '20px 10px',
    textAlign: 'center',
    fontSize: '12px',
    color: '#64748b',
  },
  convItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    color: '#94a3b8',
    fontSize: '13px',
    position: 'relative',
    transition: 'all 0.15s ease',
  },
  convItemActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: '#f8fafc',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    fontWeight: '500',
  },
  convTitle: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  deleteBtn: {
    background: 'none',
    color: '#64748b',
    padding: '4px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.6,
  },
  integrationsPanel: {
    padding: '12px 14px',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  toolPillBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px',
    backgroundColor: '#0b0f19',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '8px',
    color: '#cbd5e1',
    fontSize: '12px',
    width: '100%',
  },
  pillLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  pillLabel: {
    fontWeight: '500',
  },
  badgeConnected: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '11px',
    color: '#10b981',
    fontWeight: '600',
  },
  badgeDisconnected: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '11px',
    color: '#f59e0b',
    fontWeight: '600',
  },
  badgeModel: {
    fontSize: '11px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: '#60a5fa',
    padding: '2px 6px',
    borderRadius: '4px',
    fontWeight: '600',
  },
  footer: {
    padding: '14px 16px',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0b0f19',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    overflow: 'hidden',
  },
  userAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '600',
    fontSize: '13px',
    flexShrink: 0,
  },
  userMeta: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  userName: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#f8fafc',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userEmail: {
    fontSize: '11px',
    color: '#64748b',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  logoutBtn: {
    background: 'none',
    color: '#94a3b8',
    padding: '8px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
