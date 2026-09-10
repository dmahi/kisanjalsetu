import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerTubewellApi } from '../../api/tubewells';
import { apiErrorMessage } from '../../api/client';
import { PageHeader, Card, EmptyState, useToast, Row, Pill, Spinner } from '../../components/ui';
import { formatINR } from '../../utils/formatters';
import { useMyTubewells, useSearchTubewells } from './hooks';
import { useLocale } from '../../store/locale.store';

export default function FarmerTubewells() {
  const navigate = useNavigate();
  const { show, toast } = useToast();
  const t = useLocale((s) => s.t);
  const [search, setSearch] = useState('');
  const { results, loading } = useSearchTubewells(search);
  const { tubewells } = useMyTubewells();

  const requestJoin = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await customerTubewellApi.requestJoin(id);
      show('Registration request sent. Owner will approve it.', 'success');
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    }
  };

  const memberStatusLabel = (m: string) =>
    t(m === 'approved' ? 'approved' : m === 'pending' ? 'pending' : m === 'rejected' ? 'rejected' : m);

  return (
    <div className="page">
      {toast}
      <PageHeader title={t('tubewells')} subtitle="Search and connect to tubewells" />

      <Card title={t('my_tubewell')}>
        {tubewells.length === 0 ? (
          <p className="muted" style={{ fontSize: '0.85rem' }}>{t('no_tubewells')}</p>
        ) : (
          tubewells.map((t2) => (
            <Row
              key={t2.tubewellId}
              title={t2.name}
              sub={`${t2.village ?? t2.address} · ${formatINR(t2.ratePerHour * 100)}/hr`}
              onClick={() => navigate(`/farmer/my-tubewells/${t2.tubewellId}`)}
              right={
                <Pill tone={t2.membershipStatus === 'approved' ? 'paid' : t2.membershipStatus === 'pending' ? 'pending' : t2.membershipStatus === 'rejected' ? 'danger' : 'cancelled'}>
                  {memberStatusLabel(t2.membershipStatus)}
                </Pill>
              }
            />
          ))
        )}
      </Card>

      <Card title={t('search_tubewells')}>
        <input placeholder="Search by name, code or village…" value={search} onChange={(e) => setSearch(e.target.value)} />

        {search && loading ? <Spinner /> : null}
        {search && !loading && results.length === 0 ? (
          <EmptyState icon="🔍" title={t('no_tubewells')} />
        ) : (
          results.map((t2) => (
            <Row
              key={t2.id}
              title={t2.name}
              sub={`${t2.village ?? t2.address} · ${formatINR(t2.ratePerHour * 100)}/hr`}
              onClick={() => navigate(`/farmer/tubewells/${t2.id}`)}
              right={
                <button className="btn btn-sm btn-secondary" onClick={(e) => requestJoin(t2.id, e)}>
                  {t('request_registration')}
                </button>
              }
            />
          ))
        )}
      </Card>
    </div>
  );
}