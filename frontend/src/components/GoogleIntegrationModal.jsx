import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { Mail, CheckCircle2, XCircle, AlertTriangle, ExternalLink, RefreshCw, X, Shield, Lock } from 'lucide-react';

export function GoogleIntegrationModal({ isOpen, onClose }) {
  const { googleStatus, refreshGoogleStatus } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      refreshGoogleStatus();
    }
  }, [isOpen, refreshGoogleStatus]);

  if (!isOpen) return null;

  const isConnected = !!(googleStatus && googleStatus.connected);

  const handleConnect = async () => {
    try {
      setLoading(true);
      setError('');
      const authUrl = await api.getGoogleConnectUrl();
      if (authUrl) {
        window.location.href = authUrl;
      }
    } catch (err) {
      setError(err.message || 'Failed to generate Google connection URL.');
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Google account? Your saved tokens will be deleted from the database.')) {
      return;
    }
    try {
      setLoading(true);
      setError('');
      await api.disconnectGoogle();
      await refreshGoogleStatus();
    } catch (err) {
      setError(err.message || 'Failed to disconnect.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()} className="animate-fade-in">
        <div style={styles.modalHeader}>
          <div style={styles.headerTitleRow}>
            <div style={styles.iconBadge}>
              <Mail size={22} color="#ea4335" />
            </div>
            <div>
              <h2 style={styles.title}>Google Workspace Integration</h2>
              <p style={styles.subtitle}>Gmail & Google Contacts integration</p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={styles.errorBox}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <div style={styles.statusBox}>
          <div style={styles.statusRow}>
            <span style={styles.statusLabel}>Connection Status:</span>
            {isConnected ? (
              <span style={styles.connectedPill}>
                <CheckCircle2 size={15} style={{ marginRight: 6 }} /> Connected
              </span>
            ) : (
              <span style={styles.disconnectedPill}>
                <XCircle size={15} style={{ marginRight: 6 }} /> Not Connected
              </span>
            )}
          </div>

          {isConnected && (
            <div style={styles.detailsContainer}>
              {googleStatus.email && (
                <div style={styles.detailRow}>
                  <span style={styles.detailKey}>Connected Email:</span>
                  <span style={styles.detailVal}>{googleStatus.email}</span>
                </div>
              )}
              {googleStatus.connectedAt && (
                <div style={styles.detailRow}>
                  <span style={styles.detailKey}>Authorized Since:</span>
                  <span style={styles.detailVal}>
                    {new Date(googleStatus.connectedAt).toLocaleDateString()} {new Date(googleStatus.connectedAt).toLocaleTimeString()}
                  </span>
                </div>
              )}
              {googleStatus.scopes && (
                <div style={styles.scopesList}>
                  <span style={styles.detailKey}>Granted Permissions:</span>
                  <ul style={styles.scopeUl}>
                    {googleStatus.scopes.map((s, idx) => (
                      <li key={idx} style={styles.scopeLi}>
                        <code>{s.split('/').pop()}</code>
                      </li>
                    ))}
                  </ul>
                  {(!googleStatus.scopes.some(s => s.includes('photospicker') || s.includes('photoslibrary') || s.includes('drive'))) && (
                    <div style={{ marginTop: '8px', padding: '6px 10px', backgroundColor: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '6px', fontSize: '11px', color: '#fde047' }}>
                      ⚠️ Google Photos permissions not granted on current token. Click <strong>"Re-authorize Google"</strong> below to enable ImageKit photo sync.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={styles.infoCard}>
          <div style={styles.infoCardHeader}>
            <Lock size={16} color="#3b82f6" />
            <span style={styles.infoTitle}>Gmail, Contacts & Google Photos (Stored on ImageKit)</span>
          </div>
          <p style={styles.infoText}>
            When connected, your agent can read/send Gmail, access Contacts, and <strong>automatically sync your Google Photos directly to your ImageKit CDN storage</strong>.
            {isConnected && ' Click "Re-authorize Google" below to grant updated Photos and Gmail Send permissions.'}
          </p>
        </div>

        <div style={styles.actions}>
          {isConnected ? (
            <div style={styles.btnGroup}>
              <button
                onClick={handleConnect}
                disabled={loading}
                style={styles.reconnectBtn}
              >
                <RefreshCw size={16} style={{ marginRight: 8 }} />
                Re-authorize Google
              </button>
              <button
                onClick={handleDisconnect}
                disabled={loading}
                style={styles.disconnectBtn}
              >
                Disconnect Account
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={loading}
              style={styles.connectBtn}
            >
              <ExternalLink size={18} style={{ marginRight: 8 }} />
              {loading ? 'Redirecting to Google...' : 'Connect with Google'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px',
  },
  modal: {
    backgroundColor: '#121827',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '520px',
    padding: '28px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
  },
  headerTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  iconBadge: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    backgroundColor: 'rgba(234, 67, 53, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(234, 67, 53, 0.25)',
  },
  title: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#f8fafc',
    margin: 0,
  },
  subtitle: {
    fontSize: '13px',
    color: '#94a3b8',
    margin: '3px 0 0 0',
  },
  closeBtn: {
    background: 'none',
    color: '#94a3b8',
    padding: '6px',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#fca5a5',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
  },
  statusBox: {
    backgroundColor: '#0b0f19',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    padding: '16px',
    marginBottom: '16px',
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#cbd5e1',
  },
  connectedPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '600',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: '#10b981',
    border: '1px solid rgba(16, 185, 129, 0.3)',
  },
  disconnectedPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '600',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.25)',
  },
  detailsContainer: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
  },
  detailKey: {
    color: '#94a3b8',
  },
  detailVal: {
    color: '#f8fafc',
    fontWeight: '500',
  },
  scopesList: {
    marginTop: '4px',
  },
  scopeUl: {
    listStyle: 'none',
    paddingLeft: 0,
    marginTop: '6px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  scopeLi: {
    fontSize: '11px',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    padding: '3px 8px',
    borderRadius: '4px',
    color: '#cbd5e1',
  },
  infoCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: '10px',
    padding: '14px',
    marginBottom: '20px',
  },
  infoCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
  },
  infoTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#93c5fd',
  },
  infoText: {
    fontSize: '12px',
    color: '#94a3b8',
    lineHeight: 1.5,
    margin: 0,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  btnGroup: {
    display: 'flex',
    gap: '10px',
    width: '100%',
  },
  reconnectBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 16px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    color: '#f8fafc',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500',
  },
  disconnectBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 16px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
  },
  connectBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 20px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
  },
};
