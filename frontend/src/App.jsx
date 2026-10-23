import React, { useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { Bot } from 'lucide-react';

export default function App() {
  const { user, loading } = useAuth();
  const [authView, setAuthView] = useState('login'); // 'login' | 'register'

  if (loading) {
    return (
      <div style={styles.splash}>
        <div style={styles.splashCard} className="animate-fade-in">
          <div style={styles.logoBadge}>
            <Bot size={36} color="#3b82f6" />
          </div>
          <h2 style={styles.splashTitle}>Personal AI Agent</h2>
          <div style={styles.spinner} className="animate-pulse">Connecting to agent runtime...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    if (authView === 'register') {
      return <RegisterPage onSwitchToLogin={() => setAuthView('login')} />;
    }
    return <LoginPage onSwitchToRegister={() => setAuthView('register')} />;
  }

  return <DashboardPage />;
}

const styles = {
  splash: {
    height: '100vh',
    width: '100vw',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b0f19',
  },
  splashCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '14px',
  },
  logoBadge: {
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(59, 130, 246, 0.25)',
  },
  splashTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#f8fafc',
    margin: 0,
  },
  spinner: {
    fontSize: '13px',
    color: '#94a3b8',
  },
};
