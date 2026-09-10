import { useEffect, useState } from 'react';
import { adminApi, errMsg, type AdminTubewell } from '../lib/api';
import { useToast } from '../App';
import { Badge, Spinner, formatINR, fmtDateOnly, toneFor } from '../lib/format';

export default function Tubewells() {
  const [items, setItems] = useState<AdminTubewell[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { show } = useToast();

  const load = () => {
    setLoading(true);
    adminApi
      .tubewells({ search: search || undefined })
      .then(setItems)
      .catch((e) => show({ kind: 'error', text: errMsg(e) }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useEffect(() => {
    const t = setTimeout(load, 400);
    return () => clearTimeout(t);
  }, [search]);

  const toggle = async (t: AdminTubewell) => {
    setBusyId(t.id);
    try {
      if (t.status === 'active') await adminApi.suspendTubewell(t.id);
      else await adminApi.activateTubewell(t.id);
      load();
      show({ kind: 'success', text: `${t.name} updated` });
    } catch (e) {
      show({ kind: 'error', text: errMsg(e) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <h1 className="page-title">Tubewells</h1>
      <div className="toolbar">
        <input placeholder="Search name / code / village" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {loading ? <Spinner /> : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Address</th>
                <th>Rate / hr</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 700 }}>{t.name}</td>
                  <td>{t.code}</td>
                  <td>{t.village ? `${t.village}, ${t.address}` : t.address}</td>
                  <td>{formatINR(t.ratePerHour * 100)}</td>
                  <td><Badge tone={toneFor(t.status)}>{t.status}</Badge></td>
                  <td>{fmtDateOnly(t.createdAt)}</td>
                  <td>
                    <button
                      className={t.status === 'active' ? 'btn-danger' : 'btn-primary'}
                      disabled={busyId === t.id}
                      onClick={() => toggle(t)}
                    >
                      {t.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={7} style={{ color: '#5b6472' }}>No tubewells found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}