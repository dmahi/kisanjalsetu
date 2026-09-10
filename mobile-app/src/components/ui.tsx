import { useEffect, useState } from 'react';

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
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-sub">{subtitle}</p> : null}
      </div>
      {right}
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
  return (
    <div className="row" style={onClick ? { cursor: 'pointer' } : undefined} onClick={onClick}>
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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        {title ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 className="sheet-title">{title}</h3>
            <button className="close-btn" onClick={onClose} aria-label="Close">×</button>
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
        <button key={o.value} className={o.value === value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}