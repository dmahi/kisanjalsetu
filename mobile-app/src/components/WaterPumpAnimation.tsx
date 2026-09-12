interface WaterPumpAnimationProps {
  isRunning: boolean;
  customerName?: string;
  tubewellName?: string;
  elapsedTime?: string;
  currentBillAmount?: number;
}

export function WaterPumpAnimation({
  isRunning,
  customerName,
  tubewellName,
  elapsedTime,
  currentBillAmount,
}: WaterPumpAnimationProps) {
  return (
    <div className={`water-pump-card ${isRunning ? 'active' : 'idle'}`}>
      <div className="water-pump-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.5rem' }}>{isRunning ? '🚰' : '⏸️'}</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
              {isRunning ? 'पानी चालू है · Water Running' : 'पानी बंद है · Tubewell Idle'}
            </div>
            {tubewellName ? (
              <div style={{ fontSize: '0.82rem', opacity: 0.9 }}>📍 {tubewellName}</div>
            ) : null}
          </div>
        </div>
        <span
          style={{
            background: isRunning ? '#16a34a' : 'rgba(255,255,255,0.2)',
            color: '#fff',
            padding: '4px 10px',
            borderRadius: 999,
            fontWeight: 800,
            fontSize: '0.78rem',
            textTransform: 'uppercase',
          }}
        >
          {isRunning ? '● LIVE' : 'STOPPED'}
        </span>
      </div>

      {/* Visual Tubewell Pump & Wave Animation */}
      <div className="water-flow-container">
        {isRunning ? (
          <svg className="water-wave-svg" viewBox="0 0 400 60" fill="none" preserveAspectRatio="none">
            {/* Animated Wave 1 */}
            <path
              className="water-wave-path"
              d="M0 30 C 50 15, 100 45, 150 30 C 200 15, 250 45, 300 30 C 350 15, 400 45, 450 30 L 450 60 L 0 60 Z"
              fill="rgba(255, 255, 255, 0.35)"
            />
            {/* Animated Wave 2 */}
            <path
              className="water-wave-path"
              style={{ animationDuration: '2.2s', animationDirection: 'reverse' }}
              d="M0 35 C 40 20, 90 50, 140 35 C 190 20, 240 50, 290 35 C 340 20, 390 50, 440 35 L 440 60 L 0 60 Z"
              fill="rgba(255, 255, 255, 0.55)"
            />
          </svg>
        ) : (
          <div style={{ padding: '12px 0', opacity: 0.7, textAlign: 'center', fontSize: '0.9rem' }}>
            🚜 Tubewell is ready for next water request
          </div>
        )}
      </div>

      {isRunning ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            background: 'rgba(0, 0, 0, 0.15)',
            padding: 12,
            borderRadius: 12,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>⏱️ समय / Time</div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{elapsedTime || 'Running…'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>💵 बिल / Bill</div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>
              ₹{currentBillAmount !== undefined ? currentBillAmount : 0}
            </div>
          </div>
          {customerName ? (
            <div style={{ gridColumn: '1 / -1', fontSize: '0.85rem', fontWeight: 600 }}>
              🌾 Farmer: {customerName}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
