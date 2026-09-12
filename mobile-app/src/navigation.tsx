import { useLocation, Navigate, Link } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { useLocale } from './store/locale.store';

export function NavItem({
  to,
  icon,
  label,
  active,
}: {
  to: string;
  icon: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link to={to} className={`nav-item ${active ? 'active' : ''}`}>
      <span className="nav-icon">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

const FARMER_TABS = [
  { to: '/farmer/home', icon: '🏠', label: 'home' },
  { to: '/farmer/requests', icon: '📋', label: 'requests' },
  { to: '/farmer/sessions', icon: '💧', label: 'sessions' },
  { to: '/farmer/payments', icon: '💳', label: 'payments' },
  { to: '/farmer/profile', icon: '👤', label: 'profile' },
];

const OWNER_TABS = [
  { to: '/owner/dashboard', icon: '📊', label: 'dashboard' },
  { to: '/owner/queue', icon: '📋', label: 'queue' },
  { to: '/owner/customers', icon: '👥', label: 'customers' },
  { to: '/owner/sessions', icon: '💧', label: 'sessions' },
  { to: '/owner/payments', icon: '💳', label: 'payments' },
  { to: '/owner/profile', icon: '👤', label: 'profile' },
];

export function BottomNav() {
  const role = useAuthStore((s) => s.user?.role);
  const t = useLocale((s) => s.t);
  const location = useLocation();
  const tabs = role === 'farmer' ? FARMER_TABS : role === 'admin' ? [] : OWNER_TABS;
  if (tabs.length === 0 || !location.pathname.startsWith('/farmer') && !location.pathname.startsWith('/owner')) {
    return null;
  }
  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <NavItem
          key={tab.to}
          to={tab.to}
          icon={tab.icon}
          label={t(tab.label)}
          active={location.pathname.startsWith(tab.to)}
        />
      ))}
    </nav>
  );
}

export function roleHomePath(role: string | undefined): string {
  if (role === 'farmer') return '/farmer/home';
  return '/owner/dashboard';
}
// 
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const role = useAuthStore((s) => s.user?.role);
  if (!role) return <Navigate to="/login" replace />;
  if (!roles.includes(role)) return <Navigate to={roleHomePath(role)} replace />;
  return <>{children}</>;
}