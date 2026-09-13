import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { waterRequestApi, type WaterRequest } from '../../api/requests';
import { fieldsApi, type Field } from '../../api/common';
import { apiErrorMessage } from '../../api/client';
import { useSelectionStore } from '../../store/tubewellSelection.store';
import { useLocale } from '../../store/locale.store';
import { useMyTubewells } from './hooks';
import {
  PageHeader,
  Card,
  Spinner,
  EmptyState,
  useToast,
  Pill,
  ModalSheet,
} from '../../components/ui';
import { formatDateTime, formatDuration, formatINR } from '../../utils/formatters';

export default function FarmerWaterRequests() {
  const navigate = useNavigate();
  const { show, toast } = useToast();
  const t = useLocale((s) => s.t);
  const farmerTubewellId = useSelectionStore((s) => s.farmerTubewellId);
  const { tubewells } = useMyTubewells();

  const [requests, setRequests] = useState<WaterRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [selectedTwId, setSelectedTwId] = useState(farmerTubewellId || '');
  const [fields, setFields] = useState<Field[]>([]);
  const [fieldId, setFieldId] = useState('');
  const [cropName, setCropName] = useState('');
  const [durationHours, setDurationHours] = useState('2');
  const [preferredStartTime, setPreferredStartTime] = useState('');
  const [note, setNote] = useState('');
  const [fieldsLoading, setFieldsLoading] = useState(false);

  const selectedTubewell = tubewells.find((tw) => tw.tubewellId === (selectedTwId || farmerTubewellId));

  const statusWord = (s: string) =>
    s === 'pending' ? t('pending')
      : s === 'accepted' ? t('approved')
        : s === 'rejected' ? t('rejected')
          : s === 'completed' ? t('completed')
            : s === 'cancelled' ? t('cancelled')
              : s;

  const loadRequests = async () => {
    try {
      const data = await waterRequestApi.listForCustomer(farmerTubewellId || undefined);
      setRequests(data || []);
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, [farmerTubewellId]);

  useEffect(() => {
    const twId = selectedTwId || farmerTubewellId;
    if (!twId) return;
    setFieldsLoading(true);
    fieldsApi
      .list()
      .then((list: Field[]) => setFields(list || []))
      .catch(() => setFields([]))
      .finally(() => setFieldsLoading(false));
  }, [selectedTwId, farmerTubewellId]);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const twId = selectedTwId || farmerTubewellId;
    if (!twId) {
      show(t('select_tubewell_err'), 'error');
      return;
    }
    if (!fieldId) {
      show(t('select_field_err'), 'error');
      return;
    }

    const durationMins = Math.round(parseFloat(durationHours || '1') * 60);
    if (isNaN(durationMins) || durationMins <= 0) {
      show(t('valid_duration_err'), 'error');
      return;
    }

    setSubmitting(true);
    try {
      await waterRequestApi.create({
        tubewellId: twId,
        fieldId,
        cropName: cropName.trim() || undefined,
        requestedDurationMinutes: durationMins,
        preferredStartTime: preferredStartTime.trim() || undefined,
        note: note.trim() || undefined,
      });
      show(t('request_submitted'), 'success');
      setModalOpen(false);
      setFieldId('');
      setCropName('');
      setNote('');
      void loadRequests();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async (id: string) => {
    if (!window.confirm(t('cancel_request_confirm'))) return;
    try {
      await waterRequestApi.cancel(id);
      show(t('request_cancelled'), 'info');
      void loadRequests();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    }
  };

  return (
    <div className="page">
      {toast}
      <PageHeader
        title={t('water_requests')}
        subtitle={selectedTubewell?.name || t('manage_requests_hint')}
        right={
          <button
            className="btn btn-sm btn-primary"
            onClick={() => {
              if (farmerTubewellId) setSelectedTwId(farmerTubewellId);
              setModalOpen(true);
            }}
          >
            + {t('request_water')}
          </button>
        }
      />

      {loading ? (
        <Spinner />
      ) : requests.length === 0 ? (
        <EmptyState
          icon="🚰"
          title={t('no_water_requests')}
          hint={t('no_water_requests_hint')}
        />
      ) : (
        requests.map((req) => (
          <div key={req.id} style={{ marginBottom: 12 }}>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                    {req.fieldName || t('field')}{req.cropName ? ` (${req.cropName})` : ''}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#666', marginTop: 2 }}>
                    {req.tubewellName || t('tubewell')} ·{' '}
                    {req.status === 'completed' && req.actualDurationMinutes != null
                      ? t('actual_duration', { duration: formatDuration(req.actualDurationMinutes) })
                      : t('duration_hours', { hours: String(Math.round(req.requestedDurationMinutes / 60 * 10) / 10) })}
                    {req.status === 'completed' && req.finalAmountPaise != null
                      ? ` · ${t('total')}: ${formatINR(req.finalAmountPaise)}`
                      : ''}
                  </div>
                  {req.note ? (
                    <div style={{ fontSize: '0.82rem', color: '#444', marginTop: 4, fontStyle: 'italic' }}>
                      "{req.note}"
                    </div>
                  ) : null}
                  {req.rejectionReason ? (
                    <div style={{ fontSize: '0.82rem', color: '#d32f2f', marginTop: 4 }}>
                      {t('rejection_reason', { reason: req.rejectionReason })}
                    </div>
                  ) : null}
                  <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 6 }}>
                    {t('requested_on', { time: formatDateTime(req.createdAt) })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Pill
                    tone={
                      req.status === 'accepted'
                        ? 'paid'
                        : req.status === 'pending'
                          ? 'pending'
                          : req.status === 'rejected'
                            ? 'danger'
                            : 'neutral'
                    }
                  >
                    {statusWord(req.status).toUpperCase()}
                  </Pill>
                  {req.status === 'accepted' && req.queuePosition != null ? (
                    <div
                      style={{
                        marginTop: 6,
                        backgroundColor: '#e3f2fd',
                        color: '#1565c0',
                        padding: '4px 8px',
                        borderRadius: 6,
                        fontSize: '0.82rem',
                        fontWeight: 700,
                      }}
                    >
                      {t('queue_pos', { pos: req.queuePosition })}
                    </div>
                  ) : null}
                </div>
              </div>

              {req.status === 'pending' ? (
                <div style={{ marginTop: 12, borderTop: '1px solid #eee', paddingTop: 8, textAlign: 'right' }}>
                  <button
                    className="btn btn-sm btn-ghost"
                    style={{ color: '#d32f2f' }}
                    onClick={() => handleCancelRequest(req.id)}
                  >
                    {t('cancel_request')}
                  </button>
                </div>
              ) : null}
            </Card>
          </div>
        ))
      )}

      {/* New Water Request Modal */}
      <ModalSheet open={modalOpen} onClose={() => setModalOpen(false)} title={t('request_water')}>
        <form onSubmit={handleSubmitRequest}>
          <label>{t('select_tubewell')}</label>
          <select value={selectedTwId} onChange={(e) => setSelectedTwId(e.target.value)}>
            <option value="">{t('choose_tubewell')}</option>
            {tubewells.map((tw) => (
              <option key={tw.tubewellId} value={tw.tubewellId}>
                {tw.name}
              </option>
            ))}
          </select>

          <label>{t('select_field')}</label>
          {fieldsLoading ? (
            <p className="muted" style={{ fontSize: '0.82rem' }}>{t('field_loading')}</p>
          ) : fields.length === 0 ? (
            <p className="muted" style={{ fontSize: '0.82rem' }}>{t('no_fields_first')}</p>
          ) : (
            <select
              value={fieldId}
              onChange={(e) => {
                const id = e.target.value;
                setFieldId(id);
                const selectedField = fields.find((f) => f.id === id);
                if (selectedField?.crop) {
                  setCropName(selectedField.crop);
                }
              }}
            >
              <option value="">{t('select_field_ph')}</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} {f.crop ? `(${f.crop}) ` : ''}{f.area ? `[${f.area} ${f.areaUnit}]` : ''}
                </option>
              ))}
            </select>
          )}

          <label>{t('crop_optional')}</label>
          <input
            type="text"
            placeholder={t('crop_hint')}
            value={cropName}
            onChange={(e) => setCropName(e.target.value)}
          />

          <label>{t('requested_duration_hours')}</label>
          <input
            type="number"
            step="0.5"
            min="0.5"
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value)}
          />

          <label>{t('preferred_time')}</label>
          <input
            type="text"
            placeholder={t('preferred_time_hint')}
            value={preferredStartTime}
            onChange={(e) => setPreferredStartTime(e.target.value)}
          />

          <label>{t('farmer_note')}</label>
          <textarea
            rows={2}
            placeholder={t('farmer_note_hint')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <button
            type="submit"
            className="btn btn-primary btn-lg mt"
            disabled={submitting || !fieldId || fields.length === 0}
          >
            {submitting ? t('submitting_request') : t('submit_request')}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
}