import { useEffect, useState } from 'react';
import { notificationsApi, type ApiNotification } from '../../api/common';
import { useToast, PageHeader, Spinner, EmptyState, Card, Row } from '../../components/ui';
import { formatDateTime } from '../../utils/formatters';
import { useLocale } from '../../store/locale.store';

export default function NotificationsScreen({ title, backTo }: { title?: string; backTo: string }) {
  const { show, toast } = useToast();
  const t = useLocale((s) => s.t);
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await notificationsApi.list();
      setItems(data || []);
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not load notifications', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const markAll = async () => {
    try {
      await notificationsApi.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    } catch {
      /* ignore */
    }
  };

  const markOne = async (id: string) => {
    await notificationsApi.markRead(id).catch(() => undefined);
    setItems((prev) => prev.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)));
  };

  return (
    <div className="page">
      {toast}
      <PageHeader
        title={title ?? t('notifications')}
        subtitle="Alerts about your tubewells"
        right={<button className="btn btn-sm btn-ghost" onClick={() => void markAll()}>{t('mark_all_read')}</button>}
      />
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState icon="🔔" title={t('no_notifications')} />
      ) : (
        items.map((n) => (
          <Card key={n.id}>
            <Row
              title={n.title}
              sub={formatDateTime(n.createdAt)}
              onClick={() => void markOne(n.id)}
              right={!n.readAt ? <span className="pill pending">new</span> : <span className="muted">›</span>}
            />
            {n.body ? <p style={{ margin: '6px 2px 0', fontSize: '0.88rem', color: 'var(--ink-soft)' }}>{n.body}</p> : null}
          </Card>
        ))
      )}
      <a href={`#${backTo}`} style={{ textDecoration: 'none' }}>
        <button className="btn btn-ghost mt">{t('cancel')}</button>
      </a>
    </div>
  );
}