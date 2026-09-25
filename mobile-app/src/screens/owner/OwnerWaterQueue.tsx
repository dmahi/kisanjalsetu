import { useEffect, useState, useRef } from 'react';
import { waterRequestApi, type WaterRequest } from '../../api/requests';
import { waterQueueApi, type WaterQueueEntry, type TubewellQueueResponse } from '../../api/queue';
import { apiErrorMessage } from '../../api/client';
import { useSelectionStore } from '../../store/tubewellSelection.store';
import { useLocale } from '../../store/locale.store';
import { formatDateTime, formatINR } from '../../utils/formatters';
import { triggerHaptic, triggerHapticNotification, triggerHapticSelection } from '../../utils/haptics';
import { useSocketEvent } from '../../lib/useSocketEvents';
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

  // Drag & Drop State
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const touchDragIdxRef = useRef<number | null>(null);

  // Reject Modal State
  const [rejectingReqId, setRejectingReqId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const REJECTION_PRESETS = [
    '⚡ Electricity Power Cut',
    '🔧 Maintenance Work Scheduled',
    '⏳ Queue Capacity Full Today',
    '🌧️ High Rainfall / Canal Water Available',
  ];

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

  // Live: a farmer submitted a new request, or cancelled one via socket.
  const handleQueueEvent = () => void loadData();
  useSocketEvent('waterRequestCreated', handleQueueEvent);
  useSocketEvent('waterRequestCancelled', handleQueueEvent);
  useSocketEvent('waterRequestAccepted', handleQueueEvent);
  useSocketEvent('waterRequestRejected', handleQueueEvent);
  useSocketEvent('waterQueueChanged', handleQueueEvent);
  useSocketEvent('waterStarted', handleQueueEvent);
  useSocketEvent('waterStopped', handleQueueEvent);

  const handleAcceptRequest = async (id: string) => {
    triggerHapticSelection();
    try {
      const res = await waterRequestApi.accept(id);
      triggerHapticNotification('success');
      show(`Request accepted! Added to queue at position #${res.queuePosition}`, 'success');
      void loadData();
    } catch (err) {
      triggerHapticNotification('error');
      show(apiErrorMessage(err), 'error');
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingReqId) return;
    setSubmitting(true);
    triggerHaptic('medium');
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

  // Reorder queue via Drag and Drop
  const handleReorder = async (fromIdx: number, toIdx: number) => {
    const waitingList = queueData?.waiting || [];
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= waitingList.length || toIdx >= waitingList.length) {
      return;
    }

    triggerHapticNotification('success');

    // Optimistically update local state for instantaneous feedback
    const movedItem = waitingList[fromIdx];
    const newWaiting = [...waitingList];
    newWaiting.splice(fromIdx, 1);
    newWaiting.splice(toIdx, 0, movedItem);

    const reorderedList = newWaiting.map((item, idx) => ({
      ...item,
      queuePosition: idx + 1,
    }));

    setQueueData((prev) => (prev ? { ...prev, waiting: reorderedList } : null));

    try {
      if (toIdx === 0) {
        await waterQueueApi.moveToStart(movedItem.id);
      } else if (toIdx === waitingList.length - 1) {
        await waterQueueApi.moveToEnd(movedItem.id);
      } else if (fromIdx > toIdx) {
        for (let i = 0; i < (fromIdx - toIdx); i++) {
          await waterQueueApi.moveUp(movedItem.id);
        }
      } else {
        for (let i = 0; i < (toIdx - fromIdx); i++) {
          await waterQueueApi.moveDown(movedItem.id);
        }
      }
      show(`Reordered queue position for ${movedItem.customerName || 'Farmer'}`, 'success');
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      void loadData();
    }
  };

  // Drag & Drop event handlers (Desktop HTML5)
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
    triggerHaptic('light');
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== idx) {
      setDragOverIdx(idx);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedIdx !== null && draggedIdx !== targetIdx) {
      void handleReorder(draggedIdx, targetIdx);
    }
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  // Touch Drag & Drop event handlers (Mobile)
  const handleTouchStart = (idx: number) => {
    touchDragIdxRef.current = idx;
    setDraggedIdx(idx);
    triggerHaptic('light');
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchDragIdxRef.current === null) return;
    const touch = e.touches[0];
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!targetEl) return;
    const cardEl = targetEl.closest('[data-queue-idx]');
    if (cardEl) {
      const overIdx = parseInt(cardEl.getAttribute('data-queue-idx') || '-1', 10);
      if (overIdx >= 0 && overIdx !== dragOverIdx) {
        setDragOverIdx(overIdx);
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchDragIdxRef.current !== null && dragOverIdx !== null && touchDragIdxRef.current !== dragOverIdx) {
      void handleReorder(touchDragIdxRef.current, dragOverIdx);
    }
    touchDragIdxRef.current = null;
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleRemove = async (entry: WaterQueueEntry) => {
    triggerHapticNotification('warning');
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
      {loading ? (
        <Card title="Pending Requests">
          <Spinner />
        </Card>
      ) : requests.length === 0 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: '#ffffff',
            borderRadius: 16,
            border: '1px solid rgba(4, 106, 56, 0.12)',
            marginBottom: 14,
            boxShadow: '0 2px 10px rgba(4, 106, 56, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.1rem' }}>✨</span>
            <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0b1c12' }}>
              Pending Requests
            </span>
            <span style={{ fontSize: '0.82rem', color: '#557262' }}>
              · All caught up!
            </span>
          </div>
          <span
            style={{
              background: '#e8f5e9',
              color: '#046a38',
              padding: '3px 10px',
              borderRadius: 12,
              fontSize: '0.78rem',
              fontWeight: 800,
            }}
          >
            0 PENDING
          </span>
        </div>
      ) : (
        <Card
          title={`Pending Requests (${requests.length})`}
          action={<Pill tone="pending">{requests.length} NEED ACTION</Pill>}
        >
          {requests.map((req) => {
            const farmerInitials = (req.customerName || 'Farmer')
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            const hoursStr = Math.round((req.requestedDurationMinutes / 60) * 10) / 10;

            return (
              <div key={req.id} className="req-card req-card-pending">
                <div className="req-card-header">
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1 }}>
                    <div className="req-avatar">{farmerInitials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '1.02rem', color: '#0b1c12' }}>
                        {req.customerName || 'Farmer'}
                      </div>
                      {req.customerPhone ? (
                        <a
                          href={`tel:${req.customerPhone}`}
                          className="phone-link-chip"
                          onClick={() => triggerHaptic('light')}
                        >
                          📞 {req.customerPhone}
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <Pill tone="pending">⏱️ {hoursStr} hrs</Pill>
                </div>

                <div style={{ marginTop: 12, fontSize: '0.88rem', color: '#2d4537', display: 'grid', gap: 4 }}>
                  <div>
                    🌱 Field: <b>{req.fieldName || 'Field'}</b>
                    {req.cropName ? (
                      <span style={{ color: '#046a38', fontWeight: 700, marginLeft: 6 }}>
                        · 🌾 {req.cropName}
                      </span>
                    ) : null}
                  </div>
                  {req.preferredStartTime ? (
                    <div>
                      🕒 Preferred Start: <b>{req.preferredStartTime}</b>
                    </div>
                  ) : null}
                  {req.note ? (
                    <div
                      style={{
                        marginTop: 4,
                        padding: '6px 10px',
                        background: 'rgba(4, 106, 56, 0.05)',
                        borderRadius: 10,
                        fontSize: '0.82rem',
                        fontStyle: 'italic',
                        color: '#1c3e2b',
                      }}
                    >
                      💬 "{req.note}"
                    </div>
                  ) : null}
                </div>

                {req.pendingBalancePaise != null && req.pendingBalancePaise > 0 ? (
                  <div className="balance-alert-box">
                    <span>⚠️</span>
                    <div>
                      Outstanding Balance: <b>{formatINR(req.pendingBalancePaise)}</b>
                    </div>
                  </div>
                ) : null}

                <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
                  <button
                    className="queue-action-pill danger"
                    onClick={() => {
                      triggerHaptic('light');
                      setRejectingReqId(req.id);
                    }}
                  >
                    ❌ Reject
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    style={{ borderRadius: 20, padding: '8px 18px' }}
                    onClick={() => handleAcceptRequest(req.id)}
                  >
                    ✅ Accept & Queue
                  </button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* SECTION 2: LIVE WATER QUEUE */}
      <Card title={`Tubewell Water Queue (${waitingEntries.length} waiting)`}>
        {activeEntry ? (
          <div
            style={{
              background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
              border: '1.5px solid #81c784',
              borderRadius: 16,
              padding: 14,
              marginBottom: 16,
              boxShadow: '0 4px 14px rgba(46, 125, 50, 0.15)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 900, color: '#1b5e20', fontSize: '0.85rem', letterSpacing: '0.04em' }}>
                🟢 LIVE WATERING IN PROGRESS
              </div>
              <Pill tone="paid">ACTIVE</Pill>
            </div>
             <div style={{ fontWeight: 800, fontSize: '1.05rem', marginTop: 6, color: '#0b1c12' }}>
               👨‍🌾 {activeEntry.customerName} ({activeEntry.fieldName})
             </div>
             {activeEntry.expectedCompletionAt ? (
               <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1b5e20', marginTop: 5 }}>
                 Expected completion: {formatDateTime(activeEntry.expectedCompletionAt)} ({activeEntry.estimatedRemainingMinutes ?? 0} min remaining)
               </div>
             ) : null}
             {activeEntry.currentDelayReason ? (
               <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#b45309', marginTop: 5 }}>
                 ⏳ Delayed: {activeEntry.currentDelayReason}
               </div>
             ) : null}
          </div>
        ) : null}

        {waitingEntries.length > 1 ? (
          <div
            style={{
              padding: '8px 12px',
              background: '#e8f5e9',
              color: '#046a38',
              borderRadius: 12,
              fontSize: '0.8rem',
              fontWeight: 700,
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>💡 Drag & drop cards using the <b>⋮⋮ handle</b> to reorder queue position.</span>
          </div>
        ) : null}

        {waitingEntries.length === 0 ? (
          <EmptyState icon="📋" title="Queue is Empty" hint="No farmers currently waiting in queue." />
        ) : (
          waitingEntries.map((entry, idx) => {
            const isNext = idx === 0;
            const isDragging = draggedIdx === idx;
            const isDragOver = dragOverIdx === idx && draggedIdx !== idx;

            return (
              <div
                key={entry.id}
                data-queue-idx={idx}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className={`req-card ${isNext ? 'req-card-approved' : ''} ${isDragging ? 'dragging' : ''} ${
                  isDragOver ? 'drag-over' : ''
                }`}
                style={
                  isNext && !isDragging && !isDragOver
                    ? {
                        border: '2px solid #f57c00',
                        background: 'linear-gradient(135deg, #ffffff 0%, #fff8e0 100%)',
                      }
                    : undefined
                }
              >
                <div className="req-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    {/* Drag Handle */}
                    <div
                      className="drag-handle"
                      title="Drag to reorder"
                      onTouchStart={() => handleTouchStart(idx)}
                    >
                      ⋮⋮
                    </div>

                    <div className={`req-avatar ${isNext ? 'req-avatar-next' : ''}`}>
                      {isNext ? '🥇' : `#${entry.queuePosition}`}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '1.02rem', color: '#0b1c12' }}>
                        {entry.customerName || 'Farmer'}
                        {isNext ? (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 900,
                              background: '#f57c00',
                              color: '#fff',
                              padding: '2px 8px',
                              borderRadius: 10,
                              marginLeft: 8,
                            }}
                          >
                            NEXT
                          </span>
                        ) : null}
                      </div>
                       <div style={{ fontSize: '0.84rem', color: '#3b5446', marginTop: 2 }}>
                         🌱 {entry.fieldName || 'Field'}
                         {entry.cropName ? ` · 🌾 ${entry.cropName}` : ''}
                       </div>
                       <div style={{ fontSize: '0.78rem', color: '#1b5e20', fontWeight: 700, marginTop: 4 }}>
                         ⏱ About {entry.estimatedWaitMinutes ?? 0} min wait
                         {entry.estimatedStartAt ? ` · Start ${formatDateTime(entry.estimatedStartAt)}` : ''}
                       </div>
                       {entry.expectedCompletionAt ? (
                         <div style={{ fontSize: '0.76rem', color: '#557262', marginTop: 2 }}>
                           Expected finish: {formatDateTime(entry.expectedCompletionAt)}
                         </div>
                       ) : null}
                    </div>
                  </div>

                  {/* Clean Remove Button on Top Right */}
                  <button
                    className="queue-action-pill danger"
                    onClick={() => handleRemove(entry)}
                    style={{ padding: '6px 12px', fontSize: '0.82rem', flexShrink: 0 }}
                  >
                    🗑️ Remove
                  </button>
                </div>
              </div>
            );
          })
        )}
      </Card>

      {/* Reject Request Modal Sheet */}
      <ModalSheet
        open={Boolean(rejectingReqId)}
        onClose={() => setRejectingReqId(null)}
        title="Reject Water Request"
      >
        <form onSubmit={handleRejectSubmit}>
          <label>Select Reason Preset</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, marginBottom: 12 }}>
            {REJECTION_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`preset-chip ${rejectionReason === preset ? 'active' : ''}`}
                style={{ textAlign: 'left', padding: '10px 14px' }}
                onClick={() => {
                  triggerHapticSelection();
                  setRejectionReason(preset);
                }}
              >
                {preset}
              </button>
            ))}
          </div>

          <label>Or Enter Custom Reason</label>
          <textarea
            rows={2}
            placeholder="Type reason here..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                triggerHaptic('light');
                setRejectingReqId(null);
              }}
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

