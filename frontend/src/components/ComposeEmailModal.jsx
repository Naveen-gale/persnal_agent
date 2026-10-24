import React, { useState } from 'react';
import { Mail, Send, X, AlertCircle } from 'lucide-react';

export function ComposeEmailModal({ isOpen, onClose, onSendEmail }) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!to.trim()) {
      setError('Please provide a recipient email or contact name.');
      return;
    }
    if (!body.trim()) {
      setError('Please write an email message body.');
      return;
    }

    const cleanTo = to.trim();
    const cleanSubject = subject.trim() || 'Message from Personal AI Agent';
    const cleanBody = body.trim();

    onSendEmail(`send email to ${cleanTo} with subject "${cleanSubject}" and message: ${cleanBody}`);
    setTo('');
    setSubject('');
    setBody('');
    setError('');
    onClose();
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()} className="animate-fade-in">
        <div style={styles.modalHeader}>
          <div style={styles.headerTitleRow}>
            <div style={styles.iconBadge}>
              <Mail size={22} color="#3b82f6" />
            </div>
            <div>
              <h2 style={styles.title}>Compose & Send Gmail</h2>
              <p style={styles.subtitle}>Dispatch emails directly using your AI agent</p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={styles.errorBox}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>To (Email or Contact Name)</label>
            <input
              type="text"
              placeholder="e.g. colleague@example.com or Rahul"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                if (error) setError('');
              }}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Subject</label>
            <input
              type="text"
              placeholder="e.g. Project Sync & Next Steps"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Message Body</label>
            <textarea
              placeholder="Write your email message here... The agent will send it via your connected Gmail."
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                if (error) setError('');
              }}
              style={styles.textarea}
              rows={5}
              required
            />
          </div>

          <div style={styles.actions}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>
              Cancel
            </button>
            <button type="submit" style={styles.submitBtn}>
              <Send size={15} style={{ marginRight: 6 }} />
              Send Email via AI
            </button>
          </div>
        </form>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(5px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: '16px',
  },
  modal: {
    backgroundColor: '#121827',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '520px',
    padding: '26px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '18px',
  },
  headerTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  iconBadge: {
    width: '42px',
    height: '42px',
    borderRadius: '10px',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(59, 130, 246, 0.25)',
  },
  title: {
    fontSize: '17px',
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
    border: 'none',
    color: '#94a3b8',
    padding: '6px',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    color: '#fca5a5',
    fontSize: '13px',
    marginBottom: '16px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#cbd5e1',
    letterSpacing: '0.2px',
  },
  input: {
    backgroundColor: '#0b0f19',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '8px',
    padding: '10px 12px',
    color: '#f8fafc',
    fontSize: '14px',
    outline: 'none',
  },
  textarea: {
    backgroundColor: '#0b0f19',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '8px',
    padding: '10px 12px',
    color: '#f8fafc',
    fontSize: '14px',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '6px',
  },
  cancelBtn: {
    padding: '10px 16px',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    color: '#cbd5e1',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  submitBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 18px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};
