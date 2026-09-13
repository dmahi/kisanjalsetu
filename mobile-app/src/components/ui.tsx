import { useEffect, useState } from 'react';
import { triggerHaptic, triggerHapticNotification, triggerHapticSelection } from '../utils/haptics';
import { shareWaterReceipt } from '../utils/native';
import { pickPhoneContact } from '../utils/contacts';
import { addWaterTurnToCalendar, type CalendarEventData } from '../utils/calendar';
import { useSidebarStore } from '../store/sidebar.store';
import { useAuthStore } from '../store/auth.store';

interface Props {
  children: React.ReactNode;
}

export function Screen({ children }: Props) {
  return <div className="page">{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  right,
  showMenu = true,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  showMenu?: boolean;
}) {
  const openSidebar = useSidebarStore((s) => s.open);
  const user = useAuthStore((s) => s.user);
  const isFarmer = user?.role === 'farmer';

  return (
    <div className="emerald-header">
      <div className="emerald-header-greeting">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {showMenu && (
            <button
              onClick={() => {
                triggerHapticSelection();
                openSidebar();
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                background: 'rgba(255, 255, 255, 0.22)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.3rem',
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              aria-label="Open menu"
            >
              ☰
            </button>
          )}
          <div>
            <h1 className="emerald-header-title">{title}</h1>
            {subtitle && <p className="emerald-header-sub">{subtitle}</p>}
          </div>
        </div>
        {right ?? (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              background: 'rgba(255, 255, 255, 0.22)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              flexShrink: 0,
            }}
          >
            {isFarmer ? '👨‍🌾' : '⚡'}
          </div>
        )}
      </div>
    </div>
  );
}

export function Card({ title, children, action }: { title?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card">
      {title || action ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {title ? <p className="card-title">{title}</p> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' | 'blue' | 'amber' }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={`value ${tone ?? ''}`}>{value}</div>
    </div>
  );
}

export function Spinner() {
  return <div className="spinner" />;
}

export function EmptyState({ icon = '📭', title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div style={{ fontWeight: 700 }}>{title}</div>
      {hint ? <div className="muted" style={{ marginTop: 4, fontSize: '0.85rem' }}>{hint}</div> : null}
    </div>
  );
}

export function Pill({ children, tone }: { children: React.ReactNode; tone: string }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function Row({
  title,
  sub,
  right,
  onClick,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
}) {
  const handleClick = () => {
    if (onClick) {
      void triggerHaptic('light');
      onClick();
    }
  };

  return (
    <div className="row" style={onClick ? { cursor: 'pointer' } : undefined} onClick={handleClick}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row-title">{title}</div>
        {sub ? <div className="row-sub">{sub}</div> : null}
      </div>
      {right}
    </div>
  );
}

export function Toast({ message, type }: { message: string; type: 'success' | 'error' | 'info' }) {
  useEffect(() => {
    return () => undefined;
  }, []);
  return <div className={`toast ${type}`}>{message}</div>;
}

/** Simple bottom-sheet modal */
export function ModalSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      onClick={() => {
        void triggerHaptic('light');
        onClose();
      }}
    >
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        {title ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 className="sheet-title">{title}</h3>
            <button
              className="close-btn"
              onClick={() => {
                void triggerHaptic('light');
                onClose();
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function useToast(): { show: (msg: string, type?: 'success' | 'error' | 'info') => void; toast: React.ReactNode } {
  const [state, setState] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const show = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    void triggerHapticNotification(type === 'error' ? 'error' : type === 'success' ? 'success' : 'warning');
    setState({ msg, type });
    setTimeout(() => setState(null), 2600);
  };
  return { show, toast: state ? <Toast message={state.msg} type={state.type} /> : null };
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={o.value}
          className={o.value === value ? 'active' : ''}
          onClick={() => {
            void triggerHapticSelection();
            onChange(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** One-tap WhatsApp / OS Share Receipt Button */
export function ShareButton({
  title,
  text,
  url,
  label = '📲 Share Receipt',
  iconOnly = false,
  className,
}: {
  title: string;
  text: string;
  url?: string;
  label?: string;
  iconOnly?: boolean;
  className?: string;
}) {
  if (iconOnly) {
    return (
      <button
        type="button"
        className={className ?? 'btn-share-icon'}
        onClick={() => void shareWaterReceipt({ title, text, url })}
        title="Share Receipt / व्हाट्सएप शेयर"
        aria-label="Share Receipt"
      >
        <span>📤</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={className ?? 'btn btn-secondary'}
      onClick={() => void shareWaterReceipt({ title, text, url })}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      {label}
    </button>
  );
}

/** One-tap Phone Contact Picker Button */
export function ContactPickerButton({
  onSelect,
  label = '📲 Pick from Contacts',
}: {
  onSelect: (contact: { name?: string; phone?: string }) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      className="btn btn-sm btn-secondary"
      style={{ marginBottom: 8 }}
      onClick={async () => {
        const contact = await pickPhoneContact();
        if (contact) onSelect(contact);
      }}
    >
      {label}
    </button>
  );
}

/** Calendar Event Reminder Button */
export function CalendarButton({
  event,
  label = '📅 Add to Calendar',
  className = 'btn btn-sm btn-secondary',
}: {
  event: CalendarEventData;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => void addWaterTurnToCalendar(event)}
    >
      {label}
    </button>
  );
}