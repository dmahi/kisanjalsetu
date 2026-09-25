import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { waterTurnAlertsApi, type WaterTurnAlert } from '../../api/waterTurnAlerts';
import { apiErrorMessage } from '../../api/client';
import { PageHeader, Card, Spinner, Pill, useToast, CalendarButton } from '../../components/ui';
import { useLocale } from '../../store/locale.store';
import { useDynamicOptions } from '../../hooks/useDynamicOptions';
import { startAlertRingtone, stopAlertRingtone } from '../../utils/audio';
import { useSocketEvent } from '../../lib/useSocketEvents';

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function FarmerWaterTurnAlert() {
  const navigate = useNavigate();
  const { show, toast } = useToast();
  const t = useLocale((s) => s.t);
  const [params] = useSearchParams();
  const alertId = params.get('alert');
  const [focused, setFocused] = useState<WaterTurnAlert | null>(null);
  const [alerts, setAlerts] = useState<WaterTurnAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<'ready' | 'not_ready' | null>(null);
  const [showNotReady, setShowNotReady] = useState(false);
  const [notReadyReason, setNotReadyReason] = useState('');
  const [now, setNow] = useState(Date.now());

  const { options } = useDynamicOptions(['not_ready_reason']);
  const notReadyOptions = options['not_ready_reason'] || [];

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

  // A fresh alert (or retry/delay) arrived over the socket → refresh instantly
  // instead of waiting for the next 10s poll.
  useSocketEvent('waterTurnAlertSent', () => {
    void load(alertId || undefined);
  });

  // Owner cancelled the alert → refresh so the screen clears the ringing state;
  // the ringtone effect below then stops the tone immediately.
  useSocketEvent('waterTurnAlertStatus', (p) => {
    const status = String(p?.status || '').toUpperCase();
    const type = String(p?.type || '');
    if (status === 'CANCELLED' || type === 'water_turn_cancelled') {
      void load(alertId || undefined);
    }
  });

  // Preselect the first not-ready reason once options arrive.
  useEffect(() => {
    if (!notReadyReason && notReadyOptions.length > 0) {
      setNotReadyReason(notReadyOptions[0].code);
    }
  }, [notReadyOptions, notReadyReason]);

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

  const selectedReasonLabel = () => {
    const found = notReadyOptions.find((o) => o.code === notReadyReason);
    return found ? found.label : notReadyReason;
  };

  // Ring loud alert sound when water turn alert is active
  useEffect(() => {
    if (focused && (focused.status === 'sent' || focused.status === 'acknowledged')) {
      startAlertRingtone();
    } else {
      stopAlertRingtone();
    }
    return () => {
      stopAlertRingtone();
    };
  }, [focused]);

  const respond = async (response: 'ready' | 'not_ready') => {
    if (!focused) return;
    stopAlertRingtone();
    setResponding(response);
    try {
      await waterTurnAlertsApi.respond(focused.id, {
        response,
        note: response === 'not_ready' ? selectedReasonLabel() : undefined,
      });
      show(response === 'ready' ? t('wt_response_ready') : t('wt_response_not_ready'), 'success');
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
        <PageHeader title={t('your_water_turn')} subtitle={t('checking_alerts')} />
        <Spinner />
      </div>
    );
  }

  const recent = focused
    ? [focused, ...alerts.filter((a) => a.id !== focused.id)].slice(0, 5)
    : alerts.slice(0, 5);

  const statusText: Record<string, string> = {
    sent: t('wt_status_sent'),
    acknowledged: t('wt_status_sent'),
    ready: t('wt_status_ready'),
    not_ready: t('wt_status_not_ready'),
    no_response: t('wt_status_no_response'),
    cancelled: t('wt_status_cancelled'),
    pending: t('wt_status_pending'),
  };

  return (
    <div className="page">
      {toast}
      <PageHeader title={t('your_water_turn')} subtitle={t('respond_asap')} />

      {!focused ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '18px 0' }}>
            <div style={{ fontSize: '2rem' }}>🕐</div>
            <div style={{ fontWeight: 800, marginTop: 6 }}>{t('no_active_alert')}</div>
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: 4 }}>
              {t('no_active_alert_hint')}
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{focused.tubewellName || t('tubewell')}</div>
                <div style={{ fontSize: '0.85rem', color: '#555', marginTop: 2 }}>
                  {focused.fieldName || t('your_field')}
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

            {focused.delayNotifiedAt ? (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: '#fff3e0', border: '1px solid #ffb74d', color: '#b45309', fontWeight: 800 }}>
                ⏳ Water is running late. The owner has been notified; stay ready.
              </div>
            ) : null}
            {focused.estimatedRemainingMinutes > 0 ? (
              <div style={{ marginTop: 10, textAlign: 'center', color: '#1565c0', fontWeight: 800, fontSize: '0.88rem' }}>
                Your turn is expected in about {focused.estimatedRemainingMinutes} minutes
              </div>
            ) : null}
            {focused.cancelledReason ? (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 9, background: '#ffebee', color: '#b71c1c', fontWeight: 700, fontSize: '0.84rem' }}>
                Reason: {focused.cancelledReason}
              </div>
            ) : null}

            <div style={{ marginTop: 14, textAlign: 'center' }}>
              <div style={{ color: '#666', fontSize: '0.75rem', letterSpacing: 1 }}>{t('time_left_to_answer')}</div>
              <div
                style={{
                  fontSize: '3.2rem',
                  fontWeight: 900,
                  fontVariantNumeric: 'tabular-nums',
                  color: deadlineMs <= 0 ? '#c62828' : '#1565c0',
                }}
              >
                {deadlineMs > 0 ? formatCountdown(deadlineMs) : '--:--'}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#555', marginBottom: 10 }}>
                {t('attempt_of', { attempt: focused.attemptNumber, max: focused.maxAttempts })}
              </div>
            </div>

            {(focused.status === 'sent' || focused.status === 'acknowledged') ? (
              deadlineMs <= 0 ? (
                <div style={{ marginTop: 14, backgroundColor: '#ffebee', color: '#b71c1c', padding: 10, borderRadius: 8, fontSize: '0.85rem', fontWeight: 600 }}>
                  {t('alert_expired')}
                </div>
              ) : (
                <>
                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <button
                      className="btn-farmer-action btn-farmer-ready"
                      disabled={responding !== null}
                      onClick={() => void respond('ready')}
                    >
                      <span>👍</span>
                      <span>{responding === 'ready' ? t('confirming') : t('i_am_ready')}</span>
                    </button>
                    <button
                      className="btn-farmer-action btn-farmer-not-ready"
                      disabled={responding !== null}
                      onClick={() => setShowNotReady((v) => !v)}
                    >
                      <span>✋</span>
                      <span>{responding === 'not_ready' ? t('sending') : t('im_not_ready')}</span>
                    </button>
                  </div>
                  {showNotReady ? (
                    <div style={{ marginTop: 14 }}>
                      <label>{t('choose_reason')}</label>
                      <select value={notReadyReason} onChange={(e) => setNotReadyReason(e.target.value)}>
                        {notReadyOptions.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
                      </select>
                      <button className="btn btn-sm btn-secondary mt-sm" style={{ width: '100%' }} onClick={() => void respond('not_ready')}>
                        {t('submit_not_ready')}
                      </button>
                    </div>
                  ) : null}
                </>
              )
            ) : (
              <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: '#f1f8e9', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{statusText[focused.status] || focused.status}</div>
                <CalendarButton
                  event={{
                    title: `Water Turn: ${focused.tubewellName || 'Tubewell'}`,
                    description: `Field: ${focused.fieldName || 'My Field'}${focused.cropName ? ` - Crop: ${focused.cropName}` : ''}`,
                    startTime: new Date(),
                    durationMinutes: 60,
                  }}
                  label="📅 Add Water Turn to Calendar"
                  className="btn btn-sm btn-secondary"
                />
              </div>
            )}
          </Card>

          {recent.length > 1 ? (
            <Card title={t('recent')}>
              {recent.slice(1).map((a) => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee', fontSize: '0.85rem' }}>
                  <span>{a.tubewellName || t('tubewell')} · {a.fieldName || t('field')}</span>
                  <Pill tone={a.status === 'ready' ? 'paid' : a.status === 'not_ready' ? 'pending' : 'cancelled'}>{a.status.replace('_', ' ')}</Pill>
                </div>
              ))}
            </Card>
          ) : null}
        </>
      )}

      <button className="btn btn-sm btn-ghost mt" style={{ width: '100%' }} onClick={() => navigate('/farmer/home')}>
        ← {t('back_to_home')}
      </button>
    </div>
  );
}