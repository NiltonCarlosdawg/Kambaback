// src/App.tsx
import React, { useState, useEffect } from 'react';
import api from './services/api';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import KambaChat from './components/KambaChat';
import Transactions from './components/Transactions';
import Wallet from './components/Wallet';
import Goals from './components/Goals';
import Login from './components/Login';
import Register from './components/Register';
import Categorias from './components/Categorias';
import Perfil from './components/Perfil';
import Personalizacao from './components/Personalizacao';
import Relatorio from './components/Relatorio';
import News from './components/News';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser]                       = useState<any>(null);
  const [activePage, setActivePage]           = useState('dashboard');
  const [loading, setLoading]                 = useState(true);
  const [isRegistering, setIsRegistering]     = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const { data } = await api.get('/auth/perfil');
          if (data.success) {
            setUser(data.user);
            setIsAuthenticated(true);
          }
        } catch {
          localStorage.removeItem('accessToken');
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const handleLoginSuccess = (u: any) => {
    setUser(u);
    setIsAuthenticated(true);
    setIsRegistering(false);
  };

  // ── Loading splash ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="h-screen w-screen flex flex-col items-center justify-center gap-3 animate-in fade-in duration-300"
        style={{ backgroundColor: 'var(--bg-base, #0B0E11)' }}
      >
        {/* Logo mark */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: 'var(--accent, #cbfb46)' }}
        >
          <svg fill="black" viewBox="0 0 48 48" className="w-5 h-5">
            <path d="M6 6H42L36 24L42 42H6L12 24L6 6Z" />
          </svg>
        </div>

        {/* Wordmark */}
        <p className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary, #fff)' }}>
          Kamba<span style={{ color: 'var(--accent, #cbfb46)' }}>Pro</span>
        </p>

        {/* Spinner */}
        <div
          className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin mt-1"
          style={{
            borderColor:    'var(--accent, #cbfb46)',
            borderTopColor: 'transparent',
          }}
        />

        {/* Label */}
        <p
          className="text-[11px] font-medium"
          style={{ color: 'var(--text-faint, #555)', marginTop: -4 }}
        >
          A carregar…
        </p>
      </div>
    );
  }

  // ── Auth gates ──────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    if (isRegistering) {
      return (
        <Register
          onRegisterSuccess={handleLoginSuccess}
          onBackToLogin={() => setIsRegistering(false)}
        />
      );
    }
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onRegisterClick={() => setIsRegistering(true)}
      />
    );
  }

  // ── Page router ─────────────────────────────────────────────────────────────
  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':      return <Dashboard />;
      case 'transactions':   return <Transactions />;
      case 'cards':          return <Wallet />;
      case 'goals':          return <Goals />;
      case 'kamba':          return <KambaChat />;
      case 'categorias':     return <Categorias />;
      case 'news':           return <News />;
      case 'perfil':         return <Perfil />;
      case 'personalizacao': return <Personalizacao />;
      case 'relatorio':      return <Relatorio />;
      default:               return <Dashboard />;
    }
  };

  return (
    <Layout activePage={activePage} onNavigate={setActivePage} user={user}>
      {renderPage()}
    </Layout>
  );
};

// ThemeProvider wraps everything so CSS vars are injected before
// any component renders — including the loading splash.
const Root: React.FC = () => (
  <ThemeProvider>
    <App />
  </ThemeProvider>
);

export default Root;