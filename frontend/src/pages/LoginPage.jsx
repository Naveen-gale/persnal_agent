import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Bot, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

export function LoginPage({ onSwitchToRegister }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card} className="animate-fade-in">
        <div style={styles.header}>
          <div style={styles.logoBadge}>
            <Bot size={28} color="#3b82f6" />
          </div>
          <h1 style={styles.title}>Personal AI Agent</h1>
          <p style={styles.subtitle}>Log in to access your private agent workspace</p>
        </div>

        {error && (
          <div style={styles.errorBanner}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email Address</label>
            <div style={styles.inputWrapper}>
              <Mail size={18} style={styles.inputIcon} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                style={styles.input}
                disabled={loading}
              />
            </div>
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Password</label>
            <div style={styles.inputWrapper}>
              <Lock size={18} style={styles.inputIcon} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                style={styles.input}
                disabled={loading}
              />
            </div>
          </div>

          <button type="submit" disabled={loading} style={styles.submitButton}>
            {loading ? (
              <span className="animate-pulse">Signing in...</span>
            ) : (
              <>
                Sign In
                <ArrowRight size={18} style={{ marginLeft: 8 }} />
              </>
            )}
          </button>
        </form>

        <div style={styles.footer}>
          <p style={styles.switchText}>
            First time setting up your agent?{' '}
            <button type="button" onClick={onSwitchToRegister} style={styles.linkButton}>
              Create Account
            </button>
          </p>

          <div style={styles.securityNote}>
            <ShieldCheck size={14} color="#10b981" />
            <span>Independent app authentication. Google OAuth is configured separately inside.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    backgroundColor: '#0b0f19',
  },
  card: {
    width: '100%',
    maxWidth: '440px',
    backgroundColor: '#121827',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    padding: '36px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '28px',
  },
  logoBadge: {
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    border: '1px solid rgba(59, 130, 246, 0.24)',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#f8fafc',
    margin: '0 0 6px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: '#94a3b8',
    margin: 0,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#fca5a5',
    padding: '12px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '20px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#cbd5e1',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '14px',
    color: '#64748b',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '12px 14px 12px 42px',
    backgroundColor: '#0b0f19',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '8px',
    color: '#f8fafc',
    fontSize: '14px',
  },
  submitButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 20px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    marginTop: '6px',
  },
  footer: {
    marginTop: '28px',
    paddingTop: '20px',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    textAlign: 'center',
  },
  switchText: {
    fontSize: '13px',
    color: '#94a3b8',
    marginBottom: '16px',
  },
  linkButton: {
    background: 'none',
    color: '#3b82f6',
    fontWeight: '600',
    padding: 0,
    textDecoration: 'underline',
  },
  securityNote: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#64748b',
    lineHeight: 1.4,
  },
};
