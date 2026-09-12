import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { waterTurnAlertsApi, type WaterTurnAlert } from '../../api/waterTurnAlerts';
import { apiErrorMessage } from '../../api/client';
import { PageHeader, Card, Spinner, Pill, useToast } from '../../components/ui';

const NOT_READY_REASONS = ['Finishing up', 'Not at the pump yet', 'Field not ready', 'Water not needed right now', 'Other'];

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function FarmerWaterTurnAlert() {
  const navigate = useNavigate();
  const { show, toast } = useToast();
  const [params] = useSearchParams();
  const alertId = params.get('alert');
  const [focused, setFocused] = useState<WaterTurnAlert | null>(null);
  const [alerts, setAlerts] = useState<WaterTurnAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<'ready' | 'not_ready' | null>(null);
  const [showNotReady, setShowNotReady] = useState(false);
  const [notReadyReason, setNotReadyReason] = useState(NOT_READY_REASONS[0]);
  const [now, setNow] = useState(Date.now());

  const load = async (explicitId?: string) => {
    try {
      if (explicitId) {
        const alert = await waterTurnAlertsApi.get(explicitId);
        setFocused(alert);
        setAlerts([]);
      } else {
        const list = await waterTurnAlertsApi.listForFarmer();
        setAlerts(list || []);
        const active = (list || []).find((a) => a.status === 'sent' || a.status === 'acknowledged');
        setFocused(active || null);
      }
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(alertId || undefined);
  }, [alertId]);

  // Keep the countdown and active alert fresh while the screen is open.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = alertId ? null : setInterval(() => { void load(); }, 10000);
    return () => {
      clearInterval(tick);
      if (poll) clearInterval(poll);
    };
  }, [alertId]);

  const deadlineMs = useMemo(() => {
    if (!focused || !focused.responseDeadlineAt) return 0;
    if (focused.status !== 'sent' && focused.status !== 'acknowledged') return 0;
    return new Date(focused.responseDeadlineAt).getTime() - now;
  }, [focused, now]);

  const respond = async (response: 'ready' | 'not_ready') => {
    if (!focused) return;
    setResponding(response);
    try {
      await waterTurnAlertsApi.respond(focused.id, {
        response,
        note: response === 'not_ready' ? notReadyReason : undefined,
      });
      show(response === 'ready' ? 'Great — the owner will be notified!' : 'The owner has been notified.', 'success');
      setShowNotReady(false);
      await load(alertId || undefined);
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setResponding(null);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <PageHeader title="Your Water Turn" subtitle="Checking for new alerts…" />
        <Spinner />
      </div>
    );
  }

  const recent = focused
    ? [focused, ...alerts.filter((a) => a.id !== focused.id)].slice(0, 5)
    : alerts.slice(0, 5);

  const statusText: Record<string, string> = {
    sent: 'Waiting for your confirmation…',
    acknowledged: 'Waiting for your confirmation…',
    ready: 'Confirmed READY. The owner will start water when your turn comes.',
    not_ready: 'Confirmed NOT READY. The owner may re-check with you.',
    no_response: 'No response was recorded. Please contact the tubewell owner.',
    cancelled: 'This alert was cancelled by the owner.',
    pending: 'Alert in progress…',
  };

  return (
    <div className="page">
      {toast}
      <PageHeader title="Your Water Turn" subtitle="Respond as soon as possible" />

      {!focused ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '18px 0' }}>
            <div style={{ fontSize: '2rem' }}>🕐</div>
            <div style={{ fontWeight: 800, marginTop: 6 }}>No Active Alert</div>
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: 4 }}>
              You will see your water-turn alert here the moment the owner notifies you.
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{focused.tubewellName || 'Tubewell'}</div>
                <div style={{ fontSize: '0.85rem', color: '#555', marginTop: 2 }}>
                  {focused.fieldName || 'Your field'}
                  {focused.cropName ? ` (${focused.cropName})` : ''}
                </div>
              </div>
              <Pill tone={
                focused.status === 'ready' ? 'paid'
                  : focused.status === 'not_ready' ? 'pending'
                    : focused.status === 'no_response' ? 'danger'
                      : focused.status === 'cancelled' ? 'cancelled'
                        : 'info'
              }>
                {focused.status.toUpperCase().replace('_', ' ')}
              </Pill>
            </div>

            <div style={{ marginTop: 14, textAlign: 'center' }}>
              <div style={{ color: '#666', fontSize: '0.75rem', letterSpacing: 1 }}>TIME LEFT TO ANSWER</div>
              <div
                style={{
                  fontSize: '3rem',
                  fontWeight: 900,
                  fontVariantNumeric: 'tabular-nums',
                  color: deadlineMs <= 0 ? '#c62828' : '#1565c0',
                }}
              >
                {deadlineMs > 0 ? formatCountdown(deadlineMs) : '--:--'}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#555' }}>
                Attempt {focused.attemptNumber} of {focused.maxAttempts}
              </div>
            </div>

            {(focused.status === 'sent' || focused.status === 'acknowledged') ? (
              deadlineMs <= 0 ? (
                <div style={{ marginTop: 14, backgroundColor: '#ffebee', color: '#b71c1c', padding: 10, borderRadius: 8, fontSize: '0.85rem', fontWeight: 600 }}>
                  This alert has expired. Please contact the owner.
                </div>
              ) : (
                <>
                  <button
                    className="btn btn-primary btn-lg mt"
                    style={{ background: '#2e7d32', borderColor: '#2e7d32', fontSize: '1.05rem' }}
                    disabled={responding !== null}
                    onClick={() => void respond('ready')}
                  >
                    {responding === 'ready' ? 'Confirming…' : '✅ I AM READY'}
                  </button>
                  <button
                    className="btn btn-secondary btn-lg mt"
                    style={{ width: '100%' }}
                    disabled={responding !== null}
                    onClick={() => setShowNotReady((v) => !v)}
                  >
                    {responding === 'not_ready' ? 'Submitting…' : '❌ NOT READY — Tell Owner Why'}
                  </button>
                  {showNotReady ? (
                    <div style={{ marginTop: 14 }}>
                      <label>Why aren't you ready?</label>
                      <select value={notReadyReason} onChange={(e) => setNotReadyReason(e.target.value)}>
                        {NOT_READY_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button className="btn btn-sm btn-secondary mt-sm" style={{ width: '100%' }} onClick={() => void respond('not_ready')}>
                        Submit NOT READY
                      </button>
                    </div>
                  ) : null}
                </>
              )
            ) : (
              <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: '#f1f8e9', fontSize: '0.9rem', fontWeight: 600 }}>
                {statusText[focused.status] || focused.status}
              </div>
            )}
          </Card>

          {recent.length > 1 ? (
            <Card title="Recent">
              {recent.slice(1).map((a) => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee', fontSize: '0.85rem' }}>
                  <span>{a.tubewellName || 'Tubewell'} · {a.fieldName || 'Field'}</span>
                  <Pill tone={a.status === 'ready' ? 'paid' : a.status === 'not_ready' ? 'pending' : 'cancelled'}>{a.status.replace('_', ' ')}</Pill>
                </div>
              ))}
            </Card>
          ) : null}
        </>
      )}

      <button className="btn btn-sm btn-ghost mt" style={{ width: '100%' }} onClick={() => navigate('/farmer/home')}>
        ← Back to Home
      </button>
    </div>
  );
}