import { useEffect, useState } from 'react';
import { adminApi, errMsg, type AdminUser } from '../lib/api';
import { useToast } from '../App';
import { Badge, ROLE_LABEL, Spinner, fmtDateOnly, toneFor } from '../lib/format';

const PAGE = 20;

export default function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { show } = useToast();

  const load = () => {
    setLoading(true);
    adminApi
      .users({ role: role || undefined, search: search || undefined, page, limit: PAGE })
      .then((res) => {
        setUsers(res.items);
        setTotal(res.total);
      })
      .catch((e) => show({ kind: 'error', text: errMsg(e) }))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, role]);
  useEffect(() => {
    const t = setTimeout(load, 400);
    return () => clearTimeout(t);
  }, [search]);

  const toggle = async (u: AdminUser) => {
    setBusyId(u.id);
    try {
      if (u.status === 'active') await adminApi.suspendUser(u.id);
      else await adminApi.activateUser(u.id);
      load();
      show({ kind: 'success', text: `${u.name} updated` });
    } catch (e) {
      show({ kind: 'error', text: errMsg(e) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <h1 className="page-title">Users</h1>
      <div className="toolbar">
        <input placeholder="Search name / phone" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>
          <option value="farmer">Farmer</option>
          <option value="tubewell_owner">Owner</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      {loading ? <Spinner /> : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.phone}</td>
                  <td><Badge tone="blue">{ROLE_LABEL[u.role] ?? u.role}</Badge></td>
                  <td><Badge tone={toneFor(u.status)}>{u.status}</Badge></td>
                  <td>{fmtDateOnly(u.createdAt)}</td>
                  <td>
                    {u.role !== 'admin' && (
                      <button
                        className={u.status === 'active' ? 'btn-danger' : 'btn-primary'}
                        disabled={busyId === u.id}
                        onClick={() => toggle(u)}
                      >
                        {u.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} style={{ color: '#5b6472' }}>No users found.</td></tr>
              )}
            </tbody>
          </table>
          <div className="toolbar" style={{ marginTop: 12 }}>
            <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span style={{ color: '#5b6472', fontSize: '0.85rem' }}>
              Page {page} · {total} total
            </span>
            <button className="btn-ghost" disabled={page * PAGE >= total} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}