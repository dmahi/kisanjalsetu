import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { authApi, errMsg, getToken, setToken, type AuthUser } from './lib/api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Tubewells from './pages/Tubewells';
import Sessions from './pages/Sessions';
import Payments from './pages/Payments';

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
    if (raw) {
      try {
        setUser(JSON.parse(raw) as AuthUser);
      } catch {
        setUser(null);
      }
    }
    setReady(true);
  }, []);

  const handleLogin = async (phone: string, code: string): Promise<void> => {
    const res = await authApi.verifyOtp(phone, code, 'admin');
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
        <div className="brand">WaterApp ◆ Admin</div>
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/users">Users</NavLink>
        <NavLink to="/tubewells">Tubewells</NavLink>
        <NavLink to="/sessions">Sessions</NavLink>
        <NavLink to="/payments">Payments</NavLink>
        <button className="logout" onClick={handleLogout}>
          Sign out — {user.name}
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