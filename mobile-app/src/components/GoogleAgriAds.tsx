import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPosition,
  BannerAdSize,
} from '@capacitor-community/admob';

const TEST_BANNER_AD_UNIT_ID = 'ca-app-pub-3940256099942544/6300978111';
const BOTTOM_NAVIGATION_HEIGHT = 76;

let activeBanners = 0;
let initializePromise: Promise<void> | null = null;

async function initializeAdMob(): Promise<void> {
  if (initializePromise) return initializePromise;

  initializePromise = (async () => {
    await AdMob.initialize({ initializeForTesting: true });

    let consent = await AdMob.requestConsentInfo();
    if (consent.status === AdmobConsentStatus.REQUIRED) {
      consent = await AdMob.showConsentForm();
    }

    if (!consent.canRequestAds) return;

    await AdMob.showBanner({
      adId: TEST_BANNER_AD_UNIT_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: BOTTOM_NAVIGATION_HEIGHT,
      isTesting: true,
      npa: true,
    });
  })().catch((error) => {
    initializePromise = null;
    console.warn('AdMob initialization failed', error);
  });

  return initializePromise;
}

export function GoogleAgriAds() {
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    let mounted = true;
    activeBanners += 1;

    void initializeAdMob().then(() => {
      if (!mounted && activeBanners === 0) void AdMob.removeBanner();
    });

    return () => {
      mounted = false;
      activeBanners = Math.max(0, activeBanners - 1);
      if (activeBanners === 0) void AdMob.removeBanner();
    };
  }, []);

  return null;
}

export default GoogleAgriAds;
