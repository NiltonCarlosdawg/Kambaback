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
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import Categorias from './components/Categorias';
import Perfil from './components/Perfil';
import Personalizacao from './components/Personalizacao';
import Relatorio from './components/Relatorio';
import News from './components/News';
import OnboardingTutorial from './components/OnboardingTutorial';
import { ErrorBoundary } from './components/ErrorBoundary';

const PAGE_COMPONENTS: Record<string, React.ComponentType> = {
  dashboard: Dashboard,
  transactions: Transactions,
  cards: Wallet,
  goals: Goals,
  kamba: KambaChat,
  categorias: Categorias,
  news: News,
  perfil: Perfil,
  personalizacao: Personalizacao,
  relatorio: Relatorio,
};

type SessionUser = {
  id?: string;
  nome: string;
  email?: string;
  rendaMensalMedia?: number;
  [key: string]: any;
};

const ONBOARDING_STORAGE_VERSION = 'v1';

const getOnboardingStorageKey = (user: SessionUser | null) => {
  const identifier = user?.id || user?.email?.toLowerCase().trim();
  return identifier ? `kamba_onboarding_${ONBOARDING_STORAGE_VERSION}_${identifier}` : null;
};

const hasCompletedOnboarding = (user: SessionUser | null) => {
  const storageKey = getOnboardingStorageKey(user);
  if (!storageKey) return false;

  try {
    return localStorage.getItem(storageKey) === ONBOARDING_STORAGE_VERSION;
  } catch {
    return false;
  }
};

const markOnboardingCompleted = (user: SessionUser | null) => {
  const storageKey = getOnboardingStorageKey(user);
  if (!storageKey) return;

  try {
    localStorage.setItem(storageKey, ONBOARDING_STORAGE_VERSION);
  } catch {
    // Persistência opcional: se falhar, o onboarding volta a aparecer no próximo acesso.
  }
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [visitedPages, setVisitedPages] = useState<string[]>(['dashboard']);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const handleLogout = () => {
      setUser(null);
      setIsAuthenticated(false);
      setActivePage('dashboard');
      setVisitedPages(['dashboard']);
      setShowOnboarding(false);
    };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Em desenvolvimento, desregista o SW para não servir UI em cache
    // quando o servidor local estiver desligado.
    if (import.meta.env.DEV) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });

      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => caches.delete(key));
        });
      }

      return;
    }

    // Register service worker for PWA only in production
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const { data } = await api.get('/auth/perfil');
          if (data.success) {
            const authUser = data.user ?? data.usuario;
            const shouldShowOnboarding = !hasCompletedOnboarding(authUser);
            setUser(authUser);
            setIsAuthenticated(true);
            setIsRegistering(false);
            setShowOnboarding(shouldShowOnboarding);
            if (shouldShowOnboarding) {
              setActivePage('personalizacao');
            }
          }
        } catch {
          localStorage.removeItem('accessToken');
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    setVisitedPages((current) => (
      current.includes(activePage) ? current : [...current, activePage]
    ));
  }, [activePage]);

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

  const openAuthenticatedSession = (sessionUser: SessionUser, forceOnboarding = false) => {
    const shouldShowOnboarding = forceOnboarding || !hasCompletedOnboarding(sessionUser);
    setUser(sessionUser);
    setIsAuthenticated(true);
    setIsRegistering(false);
    setShowOnboarding(shouldShowOnboarding);

    if (shouldShowOnboarding) {
      setActivePage('personalizacao');
    }
  };

  const handleLoginSuccess = (sessionUser: SessionUser) => {
    openAuthenticatedSession(sessionUser);
  };

  const handleRegisterSuccess = (sessionUser: SessionUser) => {
    openAuthenticatedSession(sessionUser, true);
  };

  const handleOnboardingComplete = () => {
    markOnboardingCompleted(user);
    setShowOnboarding(false);
    setActivePage('personalizacao');
    setVisitedPages(['personalizacao']);
  };

  if (showOnboarding && user) {
    return (
      <OnboardingTutorial
        user={user}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  if (!isAuthenticated) {
    if (isForgotPassword) {
      return (
        <ForgotPassword
          onBackToLogin={() => { setIsForgotPassword(false); setIsRegistering(false); }}
          onOtpSent={(email) => { setResetEmail(email); setIsForgotPassword(false); setIsResetPassword(true); }}
        />
      );
    }
    if (isResetPassword) {
      return (
        <ResetPassword
          email={resetEmail}
          onBackToLogin={() => { setIsResetPassword(false); setIsRegistering(false); }}
          onResetSuccess={() => { setIsResetPassword(false); setIsRegistering(false); }}
        />
      );
    }
    if (isRegistering) {
      return (
        <Register
          onRegisterSuccess={handleRegisterSuccess}
          onBackToLogin={() => setIsRegistering(false)}
        />
      );
    }
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onRegisterClick={() => setIsRegistering(true)}
        onForgotPasswordClick={() => setIsForgotPassword(true)}
      />
    );
  }

  // ── Page router ─────────────────────────────────────────────────────────────
  const renderPageStack = () => (
    <>
      {visitedPages.map((page) => {
        const PageComponent = PAGE_COMPONENTS[page] ?? Dashboard;
        const visible = page === activePage;

        return (
          <div
            key={page}
            className="h-full"
            style={{ display: visible ? 'block' : 'none' }}
            aria-hidden={!visible}
          >
            <ErrorBoundary>
              <PageComponent />
            </ErrorBoundary>
          </div>
        );
      })}
    </>
  );

  return (
    <Layout activePage={activePage} onNavigate={setActivePage} user={user}>
      {renderPageStack()}
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
