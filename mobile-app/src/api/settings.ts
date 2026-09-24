import { apiRequest } from './client';

export interface PublicSettings {
  appName: string;
  showGoogleAds: boolean;
  adMobBannerAdUnitId: string;
  adSensePublisherId: string;
  adSenseSlotId: string;
}

export async function fetchPublicSettings(): Promise<PublicSettings> {
  return apiRequest<PublicSettings>({
    url: '/settings/public',
    method: 'GET',
  });
}
