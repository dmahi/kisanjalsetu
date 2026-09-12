import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { authApi, errMsg, getToken, setToken, systemSettingsApi, type AuthUser } from './lib/api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Tubewells from './pages/Tubewells';
import Sessions from './pages/Sessions';
import Payments from './pages/Payments';
import Settings from './pages/Settings';

export interface ToastMsg {
  kind: 'success' | 'error';
  text: string;
}

function Toaster({ toast }: { toast: ToastMsg | null }) {
  if (!toast) return null;
  return <div className={`toast ${toast.kind}`}>{toast.text}</div>;
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const showToast = (t: ToastMsg) => {
    setToast(t);
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    return bindGlobalToast(setToast);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('waterapp.admin_user');
    const token = getToken();
    if (raw && token) {
      try {
        setUser(JSON.parse(raw) as AuthUser);
      } catch {
        setToken(null);
        localStorage.removeItem('waterapp.admin_user');
        setUser(null);
      }
    } else {
      setToken(null);
      localStorage.removeItem('waterapp.admin_user');
      setUser(null);
    }
    setReady(true);

    systemSettingsApi
      .getPublicSettings()
      .then((res) => {
        if (res.appName) {
          setUser((prev) => (prev ? { ...prev, appName: res.appName } : prev));
        }
      })
      .catch(() => {
        /* fallback */
      });

    const handleUnauthorized = () => {
      setToken(null);
      localStorage.removeItem('waterapp.admin_user');
      setUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const handleLogin = async (phone: string, code: string): Promise<void> => {
    const res = await authApi.verifyOtp(phone, code, 'admin');
    setToken(res.token);
    setUser(res.user);
    localStorage.setItem('waterapp.admin_user', JSON.stringify(res.user));
    showToast({ kind: 'success', text: 'Welcome back' });
    navigate(location.state?.from?.pathname || '/dashboard');
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('waterapp.admin_user');
    setUser(null);
    navigate('/');
  };

  useEffect(() => {
    if (user?.appName) {
      document.title = `${user.appName} Admin`;
    } else {
      document.title = 'WaterApp Admin';
    }
  }, [user?.appName]);

  if (!user) {
    return (
      <>
        <Login
          onLogin={handleLogin}
          ready={ready}
          onError={(e) => showToast({ kind: 'error', text: errMsg(e) })}
        />
        <Toaster toast={toast} />
      </>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-header">
          <img src="/logo.png" alt="Logo" className="brand-logo" />
          <div className="brand-title">{user.appName ? `${user.appName} Admin` : 'WaterApp Admin'}</div>
        </div>

        <div className="admin-profile-badge">
          <div className="admin-avatar">
            {user.name ? user.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="admin-info">
            <div className="admin-name">{user.name || 'Admin'}</div>
            <div className="admin-role-tag">
              {user.role === 'admin' ? 'Super Admin' : user.role}
            </div>
          </div>
        </div>

        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/users">Users</NavLink>
        <NavLink to="/tubewells">Tubewells</NavLink>
        <NavLink to="/sessions">Sessions</NavLink>
        <NavLink to="/payments">Payments</NavLink>
        <NavLink to="/settings">Settings</NavLink>

        <button className="logout" onClick={handleLogout}>
          Sign out
        </button>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<NavigateDashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/users" element={<Users />} />
          <Route path="/tubewells" element={<Tubewells />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/payments" element={<Payments />} />
          <Route
            path="/settings"
            element={
              <Settings
                user={user}
                onUserUpdated={(u) => {
                  setUser(u);
                  localStorage.setItem('waterapp.admin_user', JSON.stringify(u));
                }}
              />
            }
          />
        </Routes>
      </main>
      <Toaster toast={toast} />
    </div>
  );
}

function NavigateDashboard() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/dashboard', { replace: true });
  }, [navigate]);
  return null;
}

export function useToast(): { show: (t: ToastMsg) => void } {
  // Simple global toast via window event so pages can trigger toasts.
  return {
    show: (t) => window.dispatchEvent(new CustomEvent<ToastMsg>('toast', { detail: t })),
  };
}

export function bindGlobalToast(setToast: (t: ToastMsg | null) => void): void {
  window.addEventListener('toast', ((e: Event) => {
    const detail = (e as CustomEvent<ToastMsg>).detail;
    setToast(detail);
    setTimeout(() => setToast(null), 3500);
  }) as EventListener);
}