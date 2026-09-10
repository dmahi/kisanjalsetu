import { useEffect, useState } from 'react';
import { adminApi, errMsg, type AdminStats } from '../lib/api';
import { useToast } from '../App';
import { formatINR, fmtDate } from '../lib/format';

export default function Dashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { show } = useToast();

  const load = () => {
    setLoading(true);
    adminApi
      .stats()
      .then(setStats)
      .catch((e) => show({ kind: 'error', text: errMsg(e) }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, []);

  if (loading && !stats) return <div className="spinner" />;

  const items: Array<{ label: string; value: string; tone?: string }> = [
    { label: 'Farmers', value: String(stats?.farmers ?? 0) },
    { label: 'Tubewell owners', value: String(stats?.owners ?? 0) },
    { label: 'Tubewells', value: String(stats?.tubewells ?? 0) },
    { label: 'Water sessions', value: String(stats?.totalSessions ?? 0) },
    { label: 'Water used', value: `${stats?.totalHours ?? 0} h` },
    { label: 'Billed', value: formatINR(stats?.totalBilledPaise ?? 0), tone: 'amber' },
    { label: 'Collected', value: formatINR(stats?.totalCollectedPaise ?? 0), tone: 'green' },
    { label: 'Outstanding', value: formatINR(stats?.totalPendingPaise ?? 0), tone: 'red' },
    { label: 'Payment records', value: String(stats?.paymentCount ?? 0) },
  ];

  return (
    <>
      <h1 className="page-title">Platform overview</h1>
      <div className="grid">
        {items.map((it) => (
          <div className="stat" key={it.label}>
            <div className="label">{it.label}</div>
            <div className={`value ${it.tone ?? ''}`}>{it.value}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <p className="muted" style={{ margin: 0 }}>
          Figures refresh every minute. Last refresh {fmtDate(new Date().toISOString())}.
        </p>
      </div>
    </>
  );
}