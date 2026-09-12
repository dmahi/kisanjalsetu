import { useEffect, useState } from 'react';
import { waterRequestApi, type WaterRequest } from '../../api/requests';
import { waterQueueApi, type WaterQueueEntry, type TubewellQueueResponse } from '../../api/queue';
import { apiErrorMessage } from '../../api/client';
import { useSelectionStore } from '../../store/tubewellSelection.store';
import { useLocale } from '../../store/locale.store';
import { formatINR } from '../../utils/formatters';
import {
  PageHeader,
  Card,
  Spinner,
  EmptyState,
  useToast,
  Pill,
  ModalSheet,
} from '../../components/ui';

export default function OwnerWaterQueue() {
  const { show, toast } = useToast();
  const t = useLocale((s) => s.t);
  const ownerTubewellId = useSelectionStore((s) => s.ownerTubewellId);

  const [requests, setRequests] = useState<WaterRequest[]>([]);
  const [queueData, setQueueData] = useState<TubewellQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Reject Modal State
  const [rejectingReqId, setRejectingReqId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    if (!ownerTubewellId) {
      setLoading(false);
      return;
    }
    try {
      const [reqList, qResp] = await Promise.all([
        waterRequestApi.listForOwner(ownerTubewellId, 'pending'),
        waterQueueApi.getQueue(ownerTubewellId),
      ]);
      setRequests(reqList || []);
      setQueueData(qResp);
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [ownerTubewellId]);

  const handleAcceptRequest = async (id: string) => {
    try {
      const res = await waterRequestApi.accept(id);
      show(`Request accepted! Added to queue at position #${res.queuePosition}`, 'success');
      void loadData();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingReqId) return;
    setSubmitting(true);
    try {
      await waterRequestApi.reject(rejectingReqId, rejectionReason.trim() || undefined);
      show('Water request rejected', 'info');
      setRejectingReqId(null);
      setRejectionReason('');
      void loadData();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMoveUp = async (entryId: string) => {
    try {
      await waterQueueApi.moveUp(entryId);
      void loadData();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    }
  };

  const handleMoveDown = async (entryId: string) => {
    try {
      await waterQueueApi.moveDown(entryId);
      void loadData();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    }
  };

  const handleMoveToStart = async (entry: WaterQueueEntry) => {
    const farmerName = entry.customerName || 'Farmer';
    if (!window.confirm(`Move ${farmerName} to the start of the queue? This will make ${farmerName} the next farmer to receive water.`)) {
      return;
    }
    try {
      await waterQueueApi.moveToStart(entry.id);
      show(`Moved ${farmerName} to position #1`, 'success');
      void loadData();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    }
  };

  const handleMoveToEnd = async (entryId: string) => {
    try {
      await waterQueueApi.moveToEnd(entryId);
      show('Moved entry to end of queue', 'info');
      void loadData();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    }
  };

  const handleRemove = async (entry: WaterQueueEntry) => {
    const farmerName = entry.customerName || 'Farmer';
    if (!window.confirm(`Remove ${farmerName}'s request from the waiting queue?`)) return;
    try {
      await waterQueueApi.remove(entry.id);
      show(`Removed ${farmerName} from queue`, 'info');
      void loadData();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    }
  };

  if (!ownerTubewellId) {
    return (
      <div className="page">
        <PageHeader title="Water Requests & Queue" />
        <EmptyState icon="🚰" title="No tubewell selected" hint="Please select a tubewell from the dashboard first." />
      </div>
    );
  }

  const waitingEntries = queueData?.waiting || [];
  const activeEntry = queueData?.active || null;

  return (
    <div className="page">
      {toast}
      <PageHeader title="Water Requests & Queue" subtitle="Manage incoming water requests and waiting queue" />

      {/* SECTION 1: PENDING WATER REQUESTS */}
      <Card title={`Pending Requests (${requests.length})`}>
        {loading ? (
          <Spinner />
        ) : requests.length === 0 ? (
          <p className="muted" style={{ fontSize: '0.85rem', margin: '8px 0' }}>
            No pending water requests at this time.
          </p>
        ) : (
          requests.map((req) => (
            <div
              key={req.id}
              style={{
                border: '1px solid #e0e0e0',
                borderRadius: 10,
                padding: 12,
                marginBottom: 10,
                backgroundColor: '#fff',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem' }}>
                    {req.customerName || 'Farmer'} {req.customerPhone ? `(${req.customerPhone})` : ''}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#555', marginTop: 2 }}>
                    Field: <b>{req.fieldName || 'Field'}</b> {req.cropName ? `· Crop: ${req.cropName}` : ''}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#555', marginTop: 2 }}>
                    Duration: <b>{Math.round(req.requestedDurationMinutes / 60 * 10) / 10} hours</b>
                    {req.preferredStartTime ? ` · Time: ${req.preferredStartTime}` : ''}
                  </div>
                  {req.note ? (
                    <div style={{ fontSize: '0.82rem', color: '#333', marginTop: 4, fontStyle: 'italic' }}>
                      Note: "{req.note}"
                    </div>
                  ) : null}
                  {req.pendingBalancePaise != null && req.pendingBalancePaise > 0 ? (
                    <div style={{ fontSize: '0.82rem', color: '#d32f2f', fontWeight: 600, marginTop: 4 }}>
                      ⚠️ Outstanding Balance: {formatINR(req.pendingBalancePaise)}
                    </div>
                  ) : null}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-sm btn-ghost"
                  style={{ color: '#d32f2f' }}
                  onClick={() => setRejectingReqId(req.id)}
                >
                  Reject
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => handleAcceptRequest(req.id)}
                >
                  Accept & Queue
                </button>
              </div>
            </div>
          ))
        )}
      </Card>

      {/* SECTION 2: LIVE WATER QUEUE */}
      <Card title={`Tubewell Water Queue (${waitingEntries.length} waiting)`}>
        {activeEntry ? (
          <div
            style={{
              backgroundColor: '#e8f5e9',
              border: '1px solid #c8e6c9',
              borderRadius: 10,
              padding: 12,
              marginBottom: 14,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, color: '#2e7d32', fontSize: '0.9rem' }}>
                🟢 CURRENTLY ACTIVE WATER SESSION
              </div>
              <Pill tone="paid">ACTIVE</Pill>
            </div>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: 4 }}>
              {activeEntry.customerName} ({activeEntry.fieldName})
            </div>
          </div>
        ) : null}

        {waitingEntries.length === 0 ? (
          <EmptyState icon="📋" title="Queue is Empty" hint="No farmers currently waiting in queue." />
        ) : (
          waitingEntries.map((entry, idx) => (
            <div
              key={entry.id}
              style={{
                border: '1px solid #e0e0e0',
                borderRadius: 10,
                padding: 12,
                marginBottom: 10,
                backgroundColor: idx === 0 ? '#fffde7' : '#ffffff',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      backgroundColor: idx === 0 ? '#fbc02d' : '#e0e0e0',
                      color: idx === 0 ? '#000' : '#333',
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                    }}
                  >
                    #{entry.queuePosition}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1rem' }}>
                      {entry.customerName || 'Farmer'}
                      {idx === 0 ? <span style={{ fontSize: '0.75rem', color: '#f57f17', marginLeft: 6 }}>(NEXT)</span> : null}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#555' }}>
                      {entry.fieldName || 'Field'}{entry.cropName ? ` · ${entry.cropName}` : ''}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginTop: 10,
                  paddingTop: 8,
                  borderTop: '1px dashed #eee',
                }}
              >
                <button
                  className="btn btn-sm btn-ghost"
                  disabled={idx === 0}
                  onClick={() => handleMoveUp(entry.id)}
                  title="Move Up"
                >
                  ↑ Up
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  disabled={idx === waitingEntries.length - 1}
                  onClick={() => handleMoveDown(entry.id)}
                  title="Move Down"
                >
                  ↓ Down
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  disabled={idx === 0}
                  onClick={() => handleMoveToStart(entry)}
                >
                  Move Start
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  disabled={idx === waitingEntries.length - 1}
                  onClick={() => handleMoveToEnd(entry.id)}
                >
                  Move End
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  style={{ color: '#d32f2f' }}
                  onClick={() => handleRemove(entry)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </Card>

      {/* Reject Request Modal */}
      <ModalSheet
        open={Boolean(rejectingReqId)}
        onClose={() => setRejectingReqId(null)}
        title="Reject Water Request"
      >
        <form onSubmit={handleRejectSubmit}>
          <label>Rejection Reason (Optional)</label>
          <textarea
            rows={3}
            placeholder="e.g. Tubewell maintenance scheduled, electricity power cut"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setRejectingReqId(null)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-danger" disabled={submitting}>
              {submitting ? 'Rejecting...' : 'Confirm Reject'}
            </button>
          </div>
        </form>
      </ModalSheet>
    </div>
  );
}
