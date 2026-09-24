import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPosition,
  BannerAdSize,
} from '@capacitor-community/admob';

const TEST_BANNER_AD_UNIT_ID = 'ca-app-pub-3940256099942544/6300978111';

interface Props {
  adClient?: string; // Optional Google AdSense publisher ID e.g. "ca-pub-3940256099942544"
  adSlot?: string;   // Optional Google AdSense slot ID e.g. "6300978111"
}

export function GoogleAgriAds({
  adClient = 'ca-pub-3940256099942544',
  adSlot = '6300978111',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [topMargin, setTopMargin] = useState<number | null>(null);

  useEffect(() => {
    const updatePosition = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Calculate offset from top of screen to position native AdMob banner inside the widget frame
        const calculatedTop = Math.max(0, Math.round(rect.top + 34));
        setTopMargin(calculatedTop);
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);
    const timer = setTimeout(updatePosition, 300);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
      clearTimeout(timer);
    };
  }, []);

  // Native Capacitor AdMob initialization & banner display inside widget card
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android' || topMargin === null) return;

    let mounted = true;

    const showAdMob = async () => {
      try {
        await AdMob.initialize({ initializeForTesting: true });
        let consent = await AdMob.requestConsentInfo();
        if (consent.status === AdmobConsentStatus.REQUIRED) {
          consent = await AdMob.showConsentForm();
        }
        if (!consent.canRequestAds) return;
        if (!mounted) return;

        await AdMob.showBanner({
          adId: TEST_BANNER_AD_UNIT_ID,
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.TOP_CENTER,
          margin: topMargin,
          isTesting: true,
          npa: true,
        });
      } catch (err) {
        console.warn('AdMob banner error', err);
      }
    };

    void showAdMob();

    return () => {
      mounted = false;
      void AdMob.removeBanner().catch(() => undefined);
    };
  }, [topMargin]);

  // Web / Webview Google AdSense script push
  useEffect(() => {
    if (Capacitor.getPlatform() === 'android') return;
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* ignore script push errors */
    }
  }, [adClient, adSlot]);

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #0288d1 0%, #039be5 50%, #29b6f6 100%)',
        borderRadius: 24,
        padding: '16px 18px',
        color: '#ffffff',
        boxShadow: '0 12px 30px rgba(2, 136, 209, 0.28)',
        marginBottom: 16,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background radial glow matching Weather Widget */}
      <div
        style={{
          position: 'absolute',
          top: -30,
          right: -30,
          width: 140,
          height: 140,
          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0) 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Widget Header Badge */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontSize: '0.78rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{
              background: 'rgba(255, 255, 255, 0.24)',
              border: '1px solid rgba(255, 255, 255, 0.35)',
              borderRadius: 14,
              padding: '3px 10px',
              color: '#fff',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            📢 Sponsored · Google Ads
          </span>
        </div>
      </div>

      {/* Google Ads Widget Display Frame */}
      <div
        ref={containerRef}
        style={{
          background: '#ffffff',
          borderRadius: 16,
          padding: '8px 10px',
          minHeight: 75,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', minHeight: '60px', textAlign: 'center' }}
          data-ad-client={adClient}
          data-ad-slot={adSlot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />

        {/* Fallback Responsive Google Ad Banner iframe */}
        <iframe
          title="Google Agri Ad"
          src={`https://googleads.g.doubleclick.net/pagead/ads?client=${adClient}&slotname=${adSlot}&w=320&h=50`}
          style={{
            width: '100%',
            height: 60,
            border: 'none',
            overflow: 'hidden',
            borderRadius: 10,
          }}
        />
      </div>
    </div>
  );
}

export default GoogleAgriAds;
