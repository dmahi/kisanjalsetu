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
import { triggerHaptic, triggerHapticNotification, triggerHapticSelection } from '../../utils/haptics';
import { shareWaterReceipt } from '../../utils/native';
import { addWaterTurnToCalendar } from '../../utils/calendar';

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

  const DURATION_PRESETS = ['1', '2', '3', '4'];
  const TIME_PRESETS = ['ASAP', 'Morning 6 AM', 'Afternoon 12 PM', 'Evening 5 PM'];

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
    triggerHaptic('medium');
    try {
      await waterRequestApi.create({
        tubewellId: twId,
        fieldId,
        cropName: cropName.trim() || undefined,
        requestedDurationMinutes: durationMins,
        preferredStartTime: preferredStartTime.trim() || undefined,
        note: note.trim() || undefined,
      });
      triggerHapticNotification('success');
      show(t('request_submitted'), 'success');
      setModalOpen(false);
      setFieldId('');
      setCropName('');
      setNote('');
      void loadRequests();
    } catch (err) {
      triggerHapticNotification('error');
      show(apiErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async (id: string) => {
    triggerHapticNotification('warning');
    if (!window.confirm(t('cancel_request_confirm'))) return;
    try {
      await waterRequestApi.cancel(id);
      show(t('request_cancelled'), 'info');
      void loadRequests();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    }
  };

  const handleAddToCalendar = async (req: WaterRequest) => {
    triggerHapticSelection();
    try {
      await addWaterTurnToCalendar({
        title: `💧 Water Turn: ${req.fieldName || 'Field'} (${req.tubewellName || 'Tubewell'})`,
        description: `Water session for crop: ${req.cropName || 'N/A'}. Duration: ${req.requestedDurationMinutes} mins.`,
        startTime: new Date(Date.now() + 15 * 60 * 1000),
        durationMinutes: req.requestedDurationMinutes,
      });
      show('Water turn added to your calendar!', 'success');
    } catch (err) {
      show('Could not add to calendar', 'error');
    }
  };

  const handleShareReceipt = async (req: WaterRequest) => {
    triggerHapticSelection();
    try {
      const receiptText = [
        `📄 *KisanJalSetu Water Receipt*`,
        `👨‍🌾 Farmer: ${req.customerName || 'Farmer'}`,
        `🌱 Field: ${req.fieldName || 'Field'} (${req.cropName || 'Crop'})`,
        `💧 Tubewell: ${req.tubewellName || 'Tubewell'}`,
        `⏱️ Duration: ${formatDuration(req.actualDurationMinutes || req.requestedDurationMinutes)}`,
        `💰 Total Bill: ${req.finalAmountPaise != null ? formatINR(req.finalAmountPaise) : 'N/A'}`,
        `🕒 Date: ${formatDateTime(req.createdAt)}`,
      ].join('\n');

      await shareWaterReceipt({
        title: '💧 Water Receipt - KisanJalSetu',
        text: receiptText,
      });
    } catch (err) {
      show('Receipt sharing failed', 'error');
    }
  };

  // Stats calculation
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'accepted').length;
  const completedCount = requests.filter((r) => r.status === 'completed').length;

  return (
    <div className="page">
      {toast}
      <PageHeader
        title={t('water_requests')}
        subtitle={selectedTubewell?.name || t('manage_requests_hint')}
        right={
          <button
            className="btn btn-sm btn-primary"
            style={{ borderRadius: 20, boxShadow: '0 4px 14px rgba(4,106,56,0.3)' }}
            onClick={() => {
              triggerHapticSelection();
              if (farmerTubewellId) setSelectedTwId(farmerTubewellId);
              setModalOpen(true);
            }}
          >
            + {t('request_water')}
          </button>
        }
      />

      {/* Quick Summary Pill Bar */}
      <div className="status-summary-bar">
        <div className="status-summary-card">
          <div className="count" style={{ color: '#f57c00' }}>{pendingCount}</div>
          <div className="lbl">PENDING</div>
        </div>
        <div className="status-summary-card">
          <div className="count" style={{ color: '#046a38' }}>{approvedCount}</div>
          <div className="lbl">APPROVED</div>
        </div>
        <div className="status-summary-card">
          <div className="count" style={{ color: '#0277bd' }}>{completedCount}</div>
          <div className="lbl">COMPLETED</div>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : requests.length === 0 ? (
        <EmptyState
          icon="🚰"
          title={t('no_water_requests')}
          hint={t('no_water_requests_hint')}
        />
      ) : (
        requests.map((req) => {
          const isPending = req.status === 'pending';
          const isApproved = req.status === 'accepted';
          const isCompleted = req.status === 'completed';
          const isRejected = req.status === 'rejected';

          const cardClass = isPending
            ? 'req-card-pending'
            : isApproved
              ? 'req-card-approved'
              : isCompleted
                ? 'req-card-completed'
                : isRejected
                  ? 'req-card-rejected'
                  : '';

          return (
            <div key={req.id} className={`req-card ${cardClass}`}>
              <div className="req-card-header">
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0b1c12' }}>
                    🌱 {req.fieldName || t('field')}
                    {req.cropName ? (
                      <span style={{ color: '#046a38', fontWeight: 700, marginLeft: 6 }}>
                        · 🌾 {req.cropName}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: '0.84rem', color: '#3b5446', marginTop: 3 }}>
                    💧 {req.tubewellName || t('tubewell')} ·{' '}
                    {isCompleted && req.actualDurationMinutes != null
                      ? t('actual_duration', { duration: formatDuration(req.actualDurationMinutes) })
                      : t('duration_hours', { hours: String(Math.round((req.requestedDurationMinutes / 60) * 10) / 10) })}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <Pill
                    tone={
                      isApproved
                        ? 'paid'
                        : isPending
                          ? 'pending'
                          : isRejected
                            ? 'danger'
                            : 'neutral'
                    }
                  >
                    {statusWord(req.status).toUpperCase()}
                  </Pill>
                  {isApproved && req.queuePosition != null ? (
                    <div
                      style={{
                        marginTop: 6,
                        background: 'linear-gradient(135deg, #046a38, #058547)',
                        color: '#ffffff',
                        padding: '4px 10px',
                        borderRadius: 12,
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        boxShadow: '0 2px 8px rgba(4,106,56,0.25)',
                      }}
                    >
                      ✨ {t('queue_pos', { pos: req.queuePosition })}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Extra Details */}
              {req.note ? (
                <div
                  style={{
                    marginTop: 8,
                    padding: '6px 10px',
                    background: 'rgba(0,0,0,0.03)',
                    borderRadius: 10,
                    fontSize: '0.82rem',
                    fontStyle: 'italic',
                  }}
                >
                  💬 "{req.note}"
                </div>
              ) : null}

              {req.rejectionReason ? (
                <div
                  style={{
                    marginTop: 8,
                    padding: '8px 12px',
                    background: '#ffebee',
                    border: '1px solid #ffcdd2',
                    borderRadius: 10,
                    fontSize: '0.82rem',
                    color: '#c62828',
                    fontWeight: 700,
                  }}
                >
                  ❌ {t('rejection_reason', { reason: req.rejectionReason })}
                </div>
              ) : null}

              {isCompleted && req.finalAmountPaise != null ? (
                <div
                  style={{
                    marginTop: 10,
                    padding: '10px 14px',
                    background: '#f1f8e9',
                    border: '1px solid #c8e6c9',
                    borderRadius: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#2e7d32' }}>
                    Total Water Bill
                  </span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1b5e20' }}>
                    {formatINR(req.finalAmountPaise)}
                  </span>
                </div>
              ) : null}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 12,
                  paddingTop: 8,
                  borderTop: '1px dashed #e0e0e0',
                }}
              >
                <div style={{ fontSize: '0.76rem', color: '#688273' }}>
                  🕒 {formatDateTime(req.createdAt)}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {isApproved ? (
                    <button
                      className="queue-action-pill"
                      onClick={() => handleAddToCalendar(req)}
                    >
                      📅 Add to Calendar
                    </button>
                  ) : null}

                  {isCompleted ? (
                    <button
                      className="queue-action-pill"
                      style={{ background: '#e8f5e9', color: '#046a38', borderColor: '#a5d6a7' }}
                      onClick={() => handleShareReceipt(req)}
                    >
                      💬 Share Receipt
                    </button>
                  ) : null}

                  {isPending ? (
                    <button
                      className="queue-action-pill danger"
                      onClick={() => handleCancelRequest(req.id)}
                    >
                      ❌ {t('cancel_request')}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* New Water Request Modal Sheet */}
      <ModalSheet open={modalOpen} onClose={() => setModalOpen(false)} title={t('request_water')}>
        <form onSubmit={handleSubmitRequest}>
          <label>{t('select_tubewell')}</label>
          <select value={selectedTwId} onChange={(e) => setSelectedTwId(e.target.value)}>
            <option value="">{t('choose_tubewell')}</option>
            {tubewells.map((tw) => (
              <option key={tw.tubewellId} value={tw.tubewellId}>
                💧 {tw.name}
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
                  🌱 {f.name} {f.crop ? `(${f.crop}) ` : ''}{f.area ? `[${f.area} ${f.areaUnit}]` : ''}
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
          <div className="preset-grid">
            {DURATION_PRESETS.map((hrs) => (
              <button
                key={hrs}
                type="button"
                className={`preset-chip ${durationHours === hrs ? 'active' : ''}`}
                onClick={() => {
                  triggerHapticSelection();
                  setDurationHours(hrs);
                }}
              >
                ⏱️ {hrs} hr{hrs !== '1' ? 's' : ''}
              </button>
            ))}
          </div>
          <input
            type="number"
            step="0.5"
            min="0.5"
            placeholder="Custom hours"
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value)}
          />

          <label>{t('preferred_time')}</label>
          <div className="preset-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {TIME_PRESETS.map((timePreset) => (
              <button
                key={timePreset}
                type="button"
                className={`preset-chip ${preferredStartTime === timePreset ? 'active' : ''}`}
                style={{ padding: '8px 6px', fontSize: '0.8rem' }}
                onClick={() => {
                  triggerHapticSelection();
                  setPreferredStartTime(timePreset);
                }}
              >
                {timePreset}
              </button>
            ))}
          </div>
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

          <div className="cost-estimate-card">
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#046a38', textTransform: 'uppercase' }}>
                Estimated Water Session
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0b1c12', marginTop: 2 }}>
                ⏱️ {durationHours || '0'} Hours Water Supply
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: '#688273' }}>Status</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#046a38' }}>Instant Queue</div>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg mt"
            style={{ borderRadius: 20 }}
            disabled={submitting || !fieldId || fields.length === 0}
          >
            {submitting ? t('submitting_request') : `🚀 ${t('submit_request')}`}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
}