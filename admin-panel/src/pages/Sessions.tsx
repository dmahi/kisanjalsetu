import { useEffect, useState } from 'react';
import { adminApi, errMsg, type AdminSession } from '../lib/api';
import { useToast } from '../App';
import { Badge, Spinner, formatINR, fmtDate, toneFor } from '../lib/format';

export default function Sessions() {
  const [items, setItems] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(true);
  const { show } = useToast();

  const load = () => {
    setLoading(true);
    adminApi
      .sessions({ limit: 200 })
      .then(setItems)
      .catch((e) => show({ kind: 'error', text: errMsg(e) }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  return (
    <>
      <h1 className="page-title">Water sessions</h1>
      {loading && items.length === 0 ? <Spinner /> : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Started</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td>{fmtDate(s.startDatetime)}</td>
                  <td>{s.durationMinutes != null ? `${s.durationMinutes} min` : '—'}</td>
                  <td><Badge tone={toneFor(s.status)}>{s.status}</Badge></td>
                  <td><Badge tone={toneFor(s.paymentStatus)}>{s.paymentStatus}</Badge></td>
                  <td style={{ fontWeight: 700 }}>{formatINR(s.finalAmountPaise)}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={5} style={{ color: '#5b6472' }}>No sessions yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}