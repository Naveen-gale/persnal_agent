import React, { useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { Bot, Loader2 } from 'lucide-react';

export default function App() {
  const { user, loading } = useAuth();
  const [authView, setAuthView] = useState('login'); // 'login' | 'register'

  if (loading) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200">
            <Bot size={24} className="text-zinc-200" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-medium tracking-tight text-zinc-200">Personal AI Agent</h2>
            <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
              <Loader2 size={13} className="animate-spin text-zinc-400" />
              <span>Connecting to secure session...</span>
            </div>
          </div>
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
