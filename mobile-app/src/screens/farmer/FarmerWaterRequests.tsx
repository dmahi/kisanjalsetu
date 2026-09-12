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
import { formatDateTime } from '../../utils/formatters';

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
      show('Please select a tubewell', 'error');
      return;
    }
    if (!fieldId) {
      show('Please select a field', 'error');
      return;
    }

    const durationMins = Math.round(parseFloat(durationHours || '1') * 60);
    if (isNaN(durationMins) || durationMins <= 0) {
      show('Please enter a valid requested duration', 'error');
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
      show('Water request submitted successfully!', 'success');
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
    if (!window.confirm('Are you sure you want to cancel this water request?')) return;
    try {
      await waterRequestApi.cancel(id);
      show('Water request cancelled', 'info');
      void loadRequests();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    }
  };

  return (
    <div className="page">
      {toast}
      <PageHeader
        title="Water Requests"
        subtitle={selectedTubewell?.name || 'Manage your tubewell water requests'}
        right={
          <button
            className="btn btn-sm btn-primary"
            onClick={() => {
              if (farmerTubewellId) setSelectedTwId(farmerTubewellId);
              setModalOpen(true);
            }}
          >
            + Request Water
          </button>
        }
      />

      {loading ? (
        <Spinner />
      ) : requests.length === 0 ? (
        <EmptyState
          icon="🚰"
          title="No Water Requests Yet"
          hint="Need water for your fields? Tap '+ Request Water' to send a request to the tubewell owner."
        />
      ) : (
        requests.map((req) => (
          <div key={req.id} style={{ marginBottom: 12 }}>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                    {req.fieldName || 'Field'}{req.cropName ? ` (${req.cropName})` : ''}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#666', marginTop: 2 }}>
                    {req.tubewellName || 'Tubewell'} · Duration: {Math.round(req.requestedDurationMinutes / 60 * 10) / 10} hours
                  </div>
                  {req.note ? (
                    <div style={{ fontSize: '0.82rem', color: '#444', marginTop: 4, fontStyle: 'italic' }}>
                      "{req.note}"
                    </div>
                  ) : null}
                  {req.rejectionReason ? (
                    <div style={{ fontSize: '0.82rem', color: '#d32f2f', marginTop: 4 }}>
                      Rejection Reason: {req.rejectionReason}
                    </div>
                  ) : null}
                  <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 6 }}>
                    Requested on {formatDateTime(req.createdAt)}
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
                    {req.status.toUpperCase()}
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
                      Queue #{req.queuePosition}
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
                    Cancel Request
                  </button>
                </div>
              ) : null}
            </Card>
          </div>
        ))
      )}

      {/* New Water Request Modal */}
      <ModalSheet open={modalOpen} onClose={() => setModalOpen(false)} title="Request Water">
        <form onSubmit={handleSubmitRequest}>
          <label>Select Tubewell</label>
          <select value={selectedTwId} onChange={(e) => setSelectedTwId(e.target.value)}>
            <option value="">Choose Tubewell...</option>
            {tubewells.map((tw) => (
              <option key={tw.tubewellId} value={tw.tubewellId}>
                {tw.name}
              </option>
            ))}
          </select>

          <label>Select Field</label>
          {fieldsLoading ? (
            <p className="muted" style={{ fontSize: '0.82rem' }}>Loading fields...</p>
          ) : fields.length === 0 ? (
            <p className="muted" style={{ fontSize: '0.82rem' }}>No fields registered yet. Please add a field first.</p>
          ) : (
            <select value={fieldId} onChange={(e) => setFieldId(e.target.value)}>
              <option value="">Select Field...</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} {f.area ? `(${f.area} ${f.areaUnit})` : ''}
                </option>
              ))}
            </select>
          )}

          <label>Crop (Optional)</label>
          <input
            type="text"
            placeholder="e.g. Wheat, Mustard, Paddy"
            value={cropName}
            onChange={(e) => setCropName(e.target.value)}
          />

          <label>Requested Duration (Hours)</label>
          <input
            type="number"
            step="0.5"
            min="0.5"
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value)}
          />

          <label>Preferred Time / Time Window (Optional)</label>
          <input
            type="text"
            placeholder="e.g. Morning 8 AM or Evening"
            value={preferredStartTime}
            onChange={(e) => setPreferredStartTime(e.target.value)}
          />

          <label>Farmer Note (Optional)</label>
          <textarea
            rows={2}
            placeholder="e.g. Need urgent irrigation for sowing"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <button
            type="submit"
            className="btn btn-primary btn-lg mt"
            disabled={submitting || !fieldId || fields.length === 0}
          >
            {submitting ? 'Submitting Request...' : 'Submit Water Request'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
}
