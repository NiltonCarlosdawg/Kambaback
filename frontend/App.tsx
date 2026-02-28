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
  const [user, setUser]           = useState<any>(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [loading, setLoading]     = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);

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

  // ── Loading splash — uses CSS vars already injected by ThemeProvider
  if (loading) {
    return (
      <div
        className="h-screen w-screen flex flex-col items-center justify-center gap-4"
        style={{ backgroundColor: 'var(--bg-base, #0B0E11)' }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
          style={{ backgroundColor: 'var(--accent, #cbfb46)' }}
        >
          <svg fill="currentColor" viewBox="0 0 48 48" className="w-6 h-6 text-black">
            <path d="M6 6H42L36 24L42 42H6L12 24L6 6Z" />
          </svg>
        </div>
        <p
          className="text-sm font-bold animate-pulse"
          style={{ color: 'var(--accent, #cbfb46)' }}
        >
          A carregar KambaPro…
        </p>
      </div>
    );
  }

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

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':     return <Dashboard />;
      case 'transactions':  return <Transactions />;
      case 'cards':         return <Wallet />;
      case 'goals':         return <Goals />;
      case 'kamba':         return <KambaChat />;
      case 'categorias':    return <Categorias />;
      case 'news':          return <News />;
      case 'perfil':        return <Perfil />;
      case 'personalizacao':return <Personalizacao />;
      case 'relatorio':     return <Relatorio />;
      default:              return <Dashboard />;
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