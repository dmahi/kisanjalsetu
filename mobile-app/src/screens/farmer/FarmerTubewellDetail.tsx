import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { tubewellApi, type TubewellSearchResult } from '../../api/tubewells';
import { customerTubewellApi } from '../../api/tubewells';
import { apiErrorMessage } from '../../api/client';
import { PageHeader, Card, Spinner, useToast, Pill, Row } from '../../components/ui';
import { formatINR } from '../../utils/formatters';
import { useLocale } from '../../store/locale.store';

export default function FarmerTubewellDetail() {
  const { id } = useParams<{ id: string }>();
  const { show, toast } = useToast();
  const t = useLocale((s) => s.t);
  const [tubewell, setTubewell] = useState<TubewellSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [requested, setRequested] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    tubewellApi
      .publicDetail(id)
      .then((t) => setTubewell(t))
      .catch((err) => show(apiErrorMessage(err), 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  const request = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      await customerTubewellApi.requestJoin(id);
      setRequested(true);
      show('Request sent successfully', 'success');
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="page">
      {toast}
      <Link to="/farmer/tubewells" className="btn btn-sm btn-ghost" style={{ width: 'auto' }}>← {t('cancel')}</Link>
      <PageHeader title={tubewell?.name ?? ''} subtitle={tubewell?.code ?? ''} />
      {tubewell ? (
        <Card>
          <Row title={t('address')} sub={tubewell.address} />
          <Row title={t('village')} sub={tubewell.village ?? '—'} />
          <Row title={t('rate_per_hour')} sub={`${formatINR(tubewell.ratePerHour * 100)}/hr`} />
          <Row title={t('status')} right={<Pill tone={tubewell.status === 'active' ? 'paid' : 'cancelled'}>{t(tubewell.status === 'active' ? 'active' : 'cancelled')}</Pill>} />
          {tubewell.description ? <Row title={t('description')} sub={tubewell.description} /> : null}
          <button className="btn btn-primary btn-lg mt" onClick={request} disabled={submitting || requested || tubewell.allowCustomerRequest === false}>
            {requested ? `✓ ${t('already_requested')}` : tubewell.allowCustomerRequest === false ? t('requests_not_accepted') : t('request_registration')}
          </button>
        </Card>
      ) : null}
    </div>
  );
}