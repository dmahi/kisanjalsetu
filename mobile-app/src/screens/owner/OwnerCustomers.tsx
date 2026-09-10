import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ownerCustomerApi, type CustomerSummary } from '../../api/tubewells';
import { tubewellApi, type Tubewell } from '../../api/tubewells';
import { apiErrorMessage } from '../../api/client';
import { useSelectionStore } from '../../store/tubewellSelection.store';
import { useLocale } from '../../store/locale.store';
import { PageHeader, Card, Spinner, EmptyState, useToast, Row, Pill } from '../../components/ui';
import { formatINR, formatDuration } from '../../utils/formatters';

export default function OwnerCustomers() {
  const navigate = useNavigate();
  const ownerTubewellId = useSelectionStore((s) => s.ownerTubewellId);
  const { show, toast } = useToast();
  const t = useLocale((s) => s.t);
  const [tubewells, setTubewells] = useState<Tubewell[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tubewellApi.mine().then((list) => setTubewells(list || [])).catch(() => undefined);
  }, []);

  const load = async () => {
    if (!ownerTubewellId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await ownerCustomerApi.list(ownerTubewellId, search || undefined);
      setCustomers(list || []);
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [ownerTubewellId, search]);

  const act = async (customerId: string, action: 'approve' | 'reject') => {
    if (!ownerTubewellId) return;
    try {
      if (action === 'approve') await ownerCustomerApi.approve(customerId, ownerTubewellId);
      else await ownerCustomerApi.reject(customerId, ownerTubewellId);
      show(`Customer ${action === 'approve' ? 'approved' : 'rejected'}`, 'success');
      void load();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    }
  };

  if (tubewells.length === 0 && !loading) {
    return (
      <div className="page">
        {toast}
        <PageHeader title={t('customers')} />
        <EmptyState icon="🚰" title={t('create_tubewell') + ' ' + t('first')} hint="Add a tubewell from Profile, then customers can join." />
        <button className="btn btn-primary" onClick={() => navigate('/owner/profile')}>{t('profile')}</button>
      </div>
    );
  }

  return (
    <div className="page">
      {toast}
      <PageHeader title={t('customers')} subtitle="People registered to your tubewell" />
      {tubewells.length > 0 ? (
        <Card>
          <label style={{ marginTop: 0 }}>{t('select_tubewell')}</label>
          <select
            value={ownerTubewellId ?? ''}
            onChange={(e) => void useSelectionStore.getState().setOwnerTubewell(e.target.value)}
          >
            <option value="">— Select —</option>
            {tubewells.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Card>
      ) : null}
      <Card>
        <input placeholder="Search by name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Card>

      {loading ? (
        <Spinner />
      ) : !ownerTubewellId ? (
        <EmptyState title="Select a tubewell" hint="Pick a tubewell above to see its customers." />
      ) : customers.length === 0 ? (
        <EmptyState icon="👥" title={t('no_customers')} hint="Share your tubewell code so farmers can request registration." />
      ) : (
        customers.map((c) => (
          <Card key={c.customerId}>
            <Row
              title={`${c.name}`}
              sub={`${c.phone}`}
              onClick={() => navigate(`/owner/customers/${c.customerId}`)}
              right={
                <div style={{ textAlign: 'right' }}>
                  <Pill tone={c.status === 'approved' ? 'paid' : c.status === 'pending' ? 'pending' : c.status === 'rejected' ? 'danger' : 'cancelled'}>
                    {t(c.status === 'approved' ? 'approved' : c.status === 'pending' ? 'pending' : c.status === 'rejected' ? 'rejected' : c.status)}
                  </Pill>
                  {c.status === 'pending' ? (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); void act(c.customerId, 'approve'); }}>{t('approve')}</button>
                      <button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); void act(c.customerId, 'reject'); }}>{t('reject')}</button>
                    </div>
                  ) : null}
                </div>
              }
            />
          </Card>
        ))
      )}
    </div>
  );
}