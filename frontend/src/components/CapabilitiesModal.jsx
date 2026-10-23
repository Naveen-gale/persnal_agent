import React, { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { Cpu, X, CheckCircle, Mail, Users, Shield, Zap, Sparkles } from 'lucide-react';

export function CapabilitiesModal({ isOpen, onClose }) {
  const [capabilities, setCapabilities] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.getCapabilities()
        .then((caps) => setCapabilities(caps))
        .catch(() => setCapabilities(null))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()} className="animate-fade-in">
        <div style={styles.modalHeader}>
          <div style={styles.headerTitleRow}>
            <div style={styles.iconBadge}>
              <Cpu size={22} color="#3b82f6" />
            </div>
            <div>
              <h2 style={styles.title}>Agent System Capabilities</h2>
              <p style={styles.subtitle}>Architecture & Active LangGraph Tools</p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div style={styles.loadingBox}>
            <span className="animate-pulse">Querying Python Agent runtime...</span>
          </div>
        ) : capabilities ? (
          <div style={styles.content}>
            <div style={styles.metaRow}>
              <div style={styles.metaCard}>
                <span style={styles.metaLabel}>LLM Provider</span>
                <span style={styles.metaValue}>Groq High-Speed API</span>
              </div>
              <div style={styles.metaCard}>
                <span style={styles.metaLabel}>Active Model</span>
                <span style={styles.metaValue}>{capabilities.model || 'openai/gpt-oss-120b'}</span>
              </div>
            </div>

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>
                <Mail size={16} color="#3b82f6" />
                Gmail Integration Tools
              </h3>
              <div style={styles.toolList}>
                <div style={styles.toolItem}>
                  <CheckCircle size={15} color="#10b981" />
                  <div>
                    <strong>list_recent_emails:</strong> Fetch latest inbox messages with sender, subject & snippet.
                  </div>
                </div>
                <div style={styles.toolItem}>
                  <CheckCircle size={15} color="#10b981" />
                  <div>
                    <strong>search_emails:</strong> Targeted search across sender, subject, date, and query terms.
                  </div>
                </div>
                <div style={styles.toolItem}>
                  <CheckCircle size={15} color="#10b981" />
                  <div>
                    <strong>summarize_emails_with_ai:</strong> Context-aware executive email summarizer.
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>
                <Users size={16} color="#10b981" />
                Google Contacts Tools
              </h3>
              <div style={styles.toolList}>
                <div style={styles.toolItem}>
                  <CheckCircle size={15} color="#10b981" />
                  <div>
                    <strong>search_contacts:</strong> Find phone numbers, emails, and notes by person name.
                  </div>
                </div>
                <div style={styles.toolItem}>
                  <CheckCircle size={15} color="#10b981" />
                  <div>
                    <strong>list_contacts:</strong> Browse top contacts saved in your Google account.
                  </div>
                </div>
                <div style={styles.toolItem}>
                  <CheckCircle size={15} color="#10b981" />
                  <div>
                    <strong>add_contact:</strong> Create and save new contacts directly to your Google account.
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.securityBox}>
              <Shield size={16} color="#3b82f6" style={{ flexShrink: 0 }} />
              <span style={styles.securityText}>
                Thread-safe <code>contextvars</code> dynamic credential injection ensures cloud compatibility without Windows Credential Manager dependencies.
              </span>
            </div>
          </div>
        ) : (
          <div style={styles.errorBox}>
            Could not fetch runtime agent capabilities. Ensure the Python agent service is running on <code>http://127.0.0.1:8000</code>.
          </div>
        )}
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
    maxWidth: '560px',
    padding: '28px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
    maxHeight: '90vh',
    overflowY: 'auto',
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
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(59, 130, 246, 0.25)',
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
  },
  loadingBox: {
    padding: '30px',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '14px',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  metaRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  metaCard: {
    backgroundColor: '#0b0f19',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  metaLabel: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: '#64748b',
    fontWeight: '600',
  },
  metaValue: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#f8fafc',
  },
  section: {
    backgroundColor: '#0b0f19',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    padding: '14px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: '0 0 10px 0',
  },
  toolList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  toolItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    fontSize: '13px',
    color: '#cbd5e1',
    lineHeight: 1.4,
  },
  securityBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '12px',
    color: '#93c5fd',
  },
  securityText: {
    lineHeight: 1.4,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#fca5a5',
    padding: '14px',
    borderRadius: '8px',
    fontSize: '13px',
  },
};
