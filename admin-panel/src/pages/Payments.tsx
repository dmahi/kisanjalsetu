import { useEffect, useState } from 'react';
import { adminApi, errMsg, type AdminPayment } from '../lib/api';
import { useToast } from '../App';
import { Badge, Spinner, formatINR, fmtDate, toneFor } from '../lib/format';

export default function Payments() {
  const [items, setItems] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const { show } = useToast();

  const load = () => {
    setLoading(true);
    adminApi
      .payments({ limit: 200 })
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
      <h1 className="page-title">Payments</h1>
      {loading && items.length === 0 ? <Spinner /> : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Source</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>{fmtDate(p.createdAt ?? '')}</td>
                  <td style={{ fontWeight: 700 }}>{formatINR(p.amountPaise)}</td>
                  <td>{p.paymentMethod}</td>
                  <td>{p.source ?? '—'}</td>
                  <td><Badge tone={toneFor(p.status)}>{p.status}</Badge></td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={5} style={{ color: '#5b6472' }}>No payments yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}