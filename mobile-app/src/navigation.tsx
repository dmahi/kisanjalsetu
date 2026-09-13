import React from 'react';
import { useLocation, Navigate, Link, useNavigate } from 'react-router-dom';
import {
  X,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from './store/auth.store';
import { useLocale } from './store/locale.store';
import { useSidebarStore } from './store/sidebar.store';
import { LanguageSelectorPill } from './components/LanguageSelectorPill';
import { UserAvatar } from './components/UserAvatar';

export function NavItem({
  to,
  icon,
  label,
  active,
}: {
  to: string;
  icon: string | React.ElementType;
  label: string;
  active: boolean;
}) {
  return (
    <Link to={to} className={`nav-item ${active ? 'active' : ''}`}>
      <span className="nav-icon" style={{ fontSize: '1.35rem', lineHeight: 1 }}>
        {typeof icon === 'string' ? (
          icon
        ) : (
          React.createElement(icon, { size: 20, strokeWidth: active ? 2.5 : 2 })
        )}
      </span>
      <span style={{ fontWeight: active ? 800 : 600 }}>{label}</span>
    </Link>
  );
}

const FARMER_TABS = [
  { to: '/farmer/home', icon: '🏡', label: 'home' },
  { to: '/farmer/sessions', icon: '💧', label: 'sessions' },
  { to: '/farmer/payments', icon: '💰', label: 'payments' },
  { to: '/farmer/profile', icon: '👨‍🌾', label: 'profile' },
];

const OWNER_TABS = [
  { to: '/owner/dashboard', icon: '📊', label: 'dashboard' },
  { to: '/owner/queue', icon: '📋', label: 'queue' },
  { to: '/owner/payments', icon: '💰', label: 'payments' },
  { to: '/owner/profile', icon: '⚡', label: 'profile' },
];

export function SidebarDrawer() {
  const isOpen = useSidebarStore((s) => s.isOpen);
  const close = useSidebarStore((s) => s.close);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const t = useLocale((s) => s.t);
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  const isFarmer = user.role === 'farmer';

  const handleNav = (path: string) => {
    close();
    navigate(path);
  };

  const handleLogout = () => {
    close();
    logout();
    navigate('/login');
  };

  return (
    <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={close}>
      <div className="sidebar-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="sidebar-header">
          <button className="sidebar-close-btn" onClick={close} aria-label="Close menu">
            <X size={18} />
          </button>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.05em', opacity: 0.9 }}>
            KISAN JALSETU
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-avatar">
              <UserAvatar user={user} size={44} />
            </div>
            <div>
              <h3 className="sidebar-user-name">{user.name || 'User'}</h3>
              <div className="sidebar-user-role">{user.phone} · {isFarmer ? '👨‍🌾 Farmer' : '⚡ Tubewell Owner'}</div>
            </div>
          </div>
        </div>

        <div className="sidebar-nav">
          <div className="sidebar-section-title">Navigation Menu</div>
          {isFarmer ? (
            <>
              <a
                className={`sidebar-item ${location.pathname === '/farmer/home' ? 'active' : ''}`}
                onClick={() => handleNav('/farmer/home')}
              >
                <span className="sidebar-item-icon">🏡</span>
                <span>{t('home')}</span>
              </a>
              <a
                className={`sidebar-item ${location.pathname === '/farmer/requests' ? 'active' : ''}`}
                onClick={() => handleNav('/farmer/requests')}
              >
                <span className="sidebar-item-icon">📋</span>
                <span>{t('water_requests') || 'Water Requests'}</span>
              </a>
              <a
                className={`sidebar-item ${location.pathname === '/farmer/sessions' ? 'active' : ''}`}
                onClick={() => handleNav('/farmer/sessions')}
              >
                <span className="sidebar-item-icon">💧</span>
                <span>{t('water_sessions') || 'Water Sessions'}</span>
              </a>
              <a
                className={`sidebar-item ${location.pathname === '/farmer/tubewells' ? 'active' : ''}`}
                onClick={() => handleNav('/farmer/tubewells')}
              >
                <span className="sidebar-item-icon">🗺️</span>
                <span>{t('tubewells')}</span>
              </a>
              <a
                className={`sidebar-item ${location.pathname === '/farmer/fields' ? 'active' : ''}`}
                onClick={() => handleNav('/farmer/fields')}
              >
                <span className="sidebar-item-icon">🌾</span>
                <span>My Fields</span>
              </a>
              <a
                className={`sidebar-item ${location.pathname === '/farmer/payments' ? 'active' : ''}`}
                onClick={() => handleNav('/farmer/payments')}
              >
                <span className="sidebar-item-icon">💰</span>
                <span>{t('payments')}</span>
              </a>
              <a
                className={`sidebar-item ${location.pathname === '/farmer/notifications' ? 'active' : ''}`}
                onClick={() => handleNav('/farmer/notifications')}
              >
                <span className="sidebar-item-icon">🔔</span>
                <span>{t('notifications') || 'Alerts & Notifications'}</span>
              </a>
              <a
                className={`sidebar-item ${location.pathname === '/farmer/profile' ? 'active' : ''}`}
                onClick={() => handleNav('/farmer/profile')}
              >
                <span className="sidebar-item-icon">👨‍🌾</span>
                <span>Profile & Settings</span>
              </a>
              <a
                className={`sidebar-item ${location.pathname === '/farmer/become-owner' ? 'active' : ''}`}
                onClick={() => handleNav('/farmer/become-owner')}
              >
                <span className="sidebar-item-icon">🚜</span>
                <span>Become a Pump Owner</span>
              </a>
            </>
          ) : (
            <>
              <a
                className={`sidebar-item ${location.pathname === '/owner/dashboard' ? 'active' : ''}`}
                onClick={() => handleNav('/owner/dashboard')}
              >
                <span className="sidebar-item-icon">📊</span>
                <span>{t('dashboard')}</span>
              </a>
              <a
                className={`sidebar-item ${location.pathname === '/owner/queue' ? 'active' : ''}`}
                onClick={() => handleNav('/owner/queue')}
              >
                <span className="sidebar-item-icon">📋</span>
                <span>Water Requests & Queue</span>
              </a>
              <a
                className={`sidebar-item ${location.pathname === '/owner/customers' ? 'active' : ''}`}
                onClick={() => handleNav('/owner/customers')}
              >
                <span className="sidebar-item-icon">👥</span>
                <span>{t('customers')}</span>
              </a>
              <a
                className={`sidebar-item ${location.pathname === '/owner/sessions' ? 'active' : ''}`}
                onClick={() => handleNav('/owner/sessions')}
              >
                <span className="sidebar-item-icon">💧</span>
                <span>{t('water_sessions') || 'Water Sessions'}</span>
              </a>
              <a
                className={`sidebar-item ${location.pathname === '/owner/payments' ? 'active' : ''}`}
                onClick={() => handleNav('/owner/payments')}
              >
                <span className="sidebar-item-icon">💰</span>
                <span>{t('payments')}</span>
              </a>
              <a
                className={`sidebar-item ${location.pathname === '/owner/reports' ? 'active' : ''}`}
                onClick={() => handleNav('/owner/reports')}
              >
                <span className="sidebar-item-icon">📈</span>
                <span>{t('reports')} & Analytics</span>
              </a>
              <a
                className={`sidebar-item ${location.pathname === '/owner/tubewells' ? 'active' : ''}`}
                onClick={() => handleNav('/owner/tubewells')}
              >
                <span className="sidebar-item-icon">🗺️</span>
                <span>My Tubewells</span>
              </a>
              <a
                className={`sidebar-item ${location.pathname === '/owner/profile' ? 'active' : ''}`}
                onClick={() => handleNav('/owner/profile')}
              >
                <span className="sidebar-item-icon">⚙️</span>
                <span>Profile & Settings</span>
              </a>
            </>
          )}
        </div>

        <div className="sidebar-footer">
          <div style={{ marginBottom: 12 }}>
            <div className="sidebar-section-title" style={{ padding: '0 0 6px' }}>Language / भाषा</div>
            <LanguageSelectorPill />
          </div>
          <button
            className="btn btn-danger"
            style={{ width: '100%', borderRadius: 12, padding: '10px 14px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={handleLogout}
          >
            <LogOut size={16} />
            <span>{t('logout') || 'Logout'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function BottomNav() {
  const role = useAuthStore((s) => s.user?.role);
  const t = useLocale((s) => s.t);
  const location = useLocation();
  const tabs = role === 'farmer' ? FARMER_TABS : role === 'admin' ? [] : OWNER_TABS;
  if (tabs.length === 0 || (!location.pathname.startsWith('/farmer') && !location.pathname.startsWith('/owner'))) {
    return null;
  }
  return (
    <>
      <SidebarDrawer />
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
    </>
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