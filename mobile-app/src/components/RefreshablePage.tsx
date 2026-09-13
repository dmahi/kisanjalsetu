import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { isCapacitorNative } from '../api/config';

const DEFAULT_THRESHOLD = 72;
const MIN_SPINNER_MS = 650;
const MAX_PULL = 110;

interface Props {
  children: ReactNode;
  /** Pull distance (px) required to trigger a refresh. */
  threshold?: number;
  /** Minimum time the spinner stays visible so the refresh feels real. */
  minSpinnerMs?: number;
  /** Called instead of remounting children. Falls back to remount when omitted. */
  onRefresh?: () => void | Promise<void>;
}

export const PULL_REFRESH_PROP = 'data-pull-refresh';

/** Pull-to-refresh wrapper. When the user drags down at the top of the page the
 *  indicator appears; releasing past the threshold remounts the page content so
 *  every data loader runs again (a full page refresh). */
export default function RefreshablePage({
  children,
  threshold = DEFAULT_THRESHOLD,
  minSpinnerMs = MIN_SPINNER_MS,
  onRefresh,
}: Props) {
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const gesture = useRef({
    tracking: false,
    startY: 0,
    active: false,
    pull: 0,
    crossed: false,
  });

  const finishTimer = useRef<number | null>(null);
  const crossedTimer = useRef<number | null>(null);

  const atTop = () => (document.scrollingElement?.scrollTop ?? window.scrollY) <= 0;

  const setPullPx = (px: number) => {
    gesture.current.pull = px;
    setPull(px);
  };

  const runRefresh = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    setPullPx(Math.min(threshold, MAX_PULL));
    window.scrollTo({ top: 0, behavior: 'auto' });
    const stop = new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, minSpinnerMs);
      finishTimer.current = timer;
    });
    Promise.resolve(onRefresh ? onRefresh() : undefined)
      .catch(() => undefined)
      .then(() => stop)
      .then(() => setRefreshKey((k) => k + 1))
      .then(() => {
        setRefreshing(false);
        setPullPx(0);
      });
  }, [refreshing, threshold, minSpinnerMs, onRefresh]);

  // Gesture handling. Touch path uses non-passive listeners so we can freeze the
  // native scroll while the indicator is being pulled; mouse path (web preview)
  // is enabled only on non-touch devices to avoid double handling.
  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    const g = gesture.current;
    const isTouch = navigator.maxTouchPoints > 0 || isCapacitorNative();

    const begin = (clientY: number) => {
      if (refreshing) return;
      if (!atTop()) return;
      g.tracking = true;
      g.active = false;
      g.startY = clientY;
      g.crossed = false;
      if (crossedTimer.current) window.clearTimeout(crossedTimer.current);
    };
    const move = (clientY: number, e: Event | null) => {
      if (!g.tracking || refreshing) return;
      const dy = clientY - g.startY;
      if (dy <= 0) {
        g.active = false;
        if (g.pull !== 0) setPullPx(0);
        return;
      }
      g.active = true;
      // Haptic bump as soon as the threshold is crossed.
      if (!g.crossed && dy >= threshold) {
        g.crossed = true;
        try {
          void Haptics.impact({ style: ImpactStyle.Light });
        } catch {
          /* not a native device */
        }
        crossedTimer.current = window.setTimeout(() => (g.crossed = false), 400);
      }
      const px = Math.min((dy * 0.5) + (g.crossed ? threshold * 0.25 : 0), MAX_PULL);
      if (g.pull !== px) setPullPx(px);
      if (e && isTouch) e.preventDefault();
    };
    const end = () => {
      if (!g.tracking) return;
      g.tracking = false;
      if (g.active) {
        if (g.pull >= threshold) runRefresh();
        else setPullPx(0);
      }
      g.active = false;
    };

    if (isTouch) {
      const onTS = (e: TouchEvent) => begin(e.touches[0].clientY);
      const onTM = (e: TouchEvent) => move(e.touches[0].clientY, e);
      const onTE = () => end();
      zone.addEventListener('touchstart', onTS, { passive: true });
      zone.addEventListener('touchmove', onTM, { passive: false });
      zone.addEventListener('touchend', onTE, { passive: true });
      zone.addEventListener('touchcancel', onTE, { passive: true });
      return () => {
        zone.removeEventListener('touchstart', onTS);
        zone.removeEventListener('touchmove', onTM);
        zone.removeEventListener('touchend', onTE);
        zone.removeEventListener('touchcancel', onTE);
      };
    }

    const onPD = (e: PointerEvent) => begin(e.clientY);
    const onPM = (e: PointerEvent) => move(e.clientY, e);
    const onPU = () => end();
    zone.addEventListener('pointerdown', onPD);
    zone.addEventListener('pointermove', onPM);
    zone.addEventListener('pointerup', onPU);
    zone.addEventListener('pointercancel', onPU);
    return () => {
      zone.removeEventListener('pointerdown', onPD);
      zone.removeEventListener('pointermove', onPM);
      zone.removeEventListener('pointerup', onPU);
      zone.removeEventListener('pointercancel', onPU);
    };
  }, [refreshing, threshold, runRefresh]);

  useEffect(
    () => () => {
      if (finishTimer.current) window.clearTimeout(finishTimer.current);
      if (crossedTimer.current) window.clearTimeout(crossedTimer.current);
    },
    [],
  );

  const show = refreshing || pull > 0;

  return (
    <div ref={zoneRef} className="pull-refresh-zone" {...{ [PULL_REFRESH_PROP]: 'true' }}>
      <div
        className={`pull-refresh-indicator ${refreshing ? 'refreshing' : ''}`}
        style={{ transform: `translateY(${show ? pull : -48}px)` }}
      >
        <div className={`pull-refresh-ripple ${pull >= threshold ? 'ready' : ''}`}>
          <div className={`pull-refresh-knob ${refreshing || pull >= threshold ? 'spin' : ''}`} />
        </div>
      </div>
      <div className="pull-refresh-content" key={refreshKey} style={{ transform: show ? `translateY(${pull}px)` : undefined }}>
        {children}
      </div>
      {refreshing ? <div className="pull-refresh-scrim" /> : null}
    </div>
  );
}