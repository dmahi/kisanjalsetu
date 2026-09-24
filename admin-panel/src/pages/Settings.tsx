import { useEffect, useState } from 'react';
import { errMsg, systemSettingsApi, usersApi, type AuthUser, type SystemSettings } from '../lib/api';
import { useToast } from '../App';

interface Props {
  user: AuthUser;
  onUserUpdated: (u: AuthUser) => void;
}

export default function Settings({ user, onUserUpdated }: Props) {
  const { show } = useToast();

  // Profile form state
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // System, FCM & Google Ads settings state (app_settings collection)
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [appName, setAppName] = useState(user.appName || '');
  const [fcmJson, setFcmJson] = useState('');
  const [fcmServerKey, setFcmServerKey] = useState('');
  const [showGoogleAds, setShowGoogleAds] = useState(false);
  const [adMobBannerAdUnitId, setAdMobBannerAdUnitId] = useState('ca-app-pub-3940256099942544/6300978111');
  const [adSensePublisherId, setAdSensePublisherId] = useState('ca-pub-3940256099942544');
  const [adSenseSlotId, setAdSenseSlotId] = useState('6300978111');
  const [savingSystemSettings, setSavingSystemSettings] = useState(false);

  // Password form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    systemSettingsApi
      .getAdminSettings()
      .then((s) => {
        setSystemSettings(s);
        setAppName(s.appName || user.appName || '');
        setFcmJson(s.firebaseServiceAccount || '');
        setFcmServerKey(s.firebaseServerKey || '');
        setShowGoogleAds(s.showGoogleAds ?? false);
        if (s.adMobBannerAdUnitId) setAdMobBannerAdUnitId(s.adMobBannerAdUnitId);
        if (s.adSensePublisherId) setAdSensePublisherId(s.adSensePublisherId);
        if (s.adSenseSlotId) setAdSenseSlotId(s.adSenseSlotId);
      })
      .catch(() => {
        /* silent fallback if server starting */
      });
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      show({ kind: 'error', text: 'Name cannot be empty' });
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await usersApi.updateMe({ name: name.trim(), email: email.trim() || undefined });
      onUserUpdated(updated);
      show({ kind: 'success', text: 'Profile details updated successfully' });
    } catch (err) {
      show({ kind: 'error', text: errMsg(err, 'Failed to update profile') });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveSystemSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim()) {
      show({ kind: 'error', text: 'App Name cannot be empty' });
      return;
    }
    if (fcmJson.trim()) {
      try {
        JSON.parse(fcmJson.trim());
      } catch {
        show({ kind: 'error', text: 'Firebase Service Account must be valid JSON' });
        return;
      }
    }
    setSavingSystemSettings(true);
    try {
      const updated = await systemSettingsApi.updateAdminSettings({
        appName: appName.trim(),
        firebaseServiceAccount: fcmJson.trim(),
        firebaseServerKey: fcmServerKey.trim(),
        showGoogleAds,
        adMobBannerAdUnitId: adMobBannerAdUnitId.trim(),
        adSensePublisherId: adSensePublisherId.trim(),
        adSenseSlotId: adSenseSlotId.trim(),
      });
      setSystemSettings(updated);
      onUserUpdated({ ...user, appName: updated.appName });
      show({ kind: 'success', text: 'System, FCM & Google Ads settings saved successfully' });
    } catch (err) {
      show({ kind: 'error', text: errMsg(err, 'Failed to save system settings') });
    } finally {
      setSavingSystemSettings(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      show({ kind: 'error', text: 'Password must be at least 6 characters long' });
      return;
    }
    if (password !== confirmPassword) {
      show({ kind: 'error', text: 'New passwords do not match' });
      return;
    }
    setSavingPassword(true);
    try {
      await usersApi.updateMe({ password });
      setPassword('');
      setConfirmPassword('');
      show({ kind: 'success', text: 'Password updated successfully' });
    } catch (err) {
      show({ kind: 'error', text: errMsg(err, 'Failed to change password') });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Admin Profile &amp; System Settings</h1>

      <div className="grid-settings" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* App & Push Notification Settings (Stored in app_settings database collection) */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <h2 className="card-title">App &amp; Push Notification Settings (FCM Database Config)</h2>
          <form onSubmit={handleSaveSystemSettings}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: 4 }}>
                Application Name (stored in app_settings table)
              </label>
              <input
                style={{ width: '100%', maxWidth: 450, margin: 0 }}
                type="text"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="e.g. KisanJalSetu"
                required
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: 4 }}>
                Firebase Service Account JSON (FCM V1 API Credentials)
              </label>
              <textarea
                style={{
                  width: '100%',
                  height: 120,
                  fontFamily: 'monospace',
                  fontSize: '0.82rem',
                  padding: '10px',
                  border: '1.5px solid var(--line)',
                  borderRadius: 8,
                }}
                value={fcmJson}
                onChange={(e) => setFcmJson(e.target.value)}
                placeholder='{"type": "service_account", "project_id": "...", "private_key": "..."}'
              />
              <span className="muted" style={{ fontSize: '0.78rem' }}>
                Paste your Firebase Admin SDK service account JSON here to send push notifications dynamically.
              </span>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: 4 }}>
                Firebase Legacy Server Key (Optional Fallback)
              </label>
              <input
                style={{ width: '100%', maxWidth: 450, margin: 0 }}
                type="text"
                value={fcmServerKey}
                onChange={(e) => setFcmServerKey(e.target.value)}
                placeholder="AAAA..."
              />
            </div>

            {/* Google Ads Monetization & Display Settings */}
            <div
              style={{
                marginTop: 24,
                paddingTop: 18,
                borderTop: '1px dashed var(--line)',
                marginBottom: 18,
              }}
            >
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12, color: '#0288d1', display: 'flex', alignItems: 'center', gap: 6 }}>
                📢 Google Ads &amp; Monetization Settings
              </h3>

              {/* Show / Hide Ads Toggle */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 16,
                  background: 'var(--bg-muted, #f8fafc)',
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                }}
              >
                <input
                  type="checkbox"
                  id="showGoogleAdsToggle"
                  checked={showGoogleAds}
                  onChange={(e) => setShowGoogleAds(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <label htmlFor="showGoogleAdsToggle" style={{ fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}>
                  Enable Google Ads in Mobile App (Current Status: {showGoogleAds ? '🟢 VISIBLE' : '🔴 HIDDEN'})
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: 4 }}>
                    AdMob Banner Ad Unit ID (Android Native)
                  </label>
                  <input
                    style={{ width: '100%', margin: 0, fontFamily: 'monospace', fontSize: '0.82rem' }}
                    type="text"
                    value={adMobBannerAdUnitId}
                    onChange={(e) => setAdMobBannerAdUnitId(e.target.value)}
                    placeholder="ca-app-pub-3940256099942544/6300978111"
                  />
                  <span className="muted" style={{ fontSize: '0.75rem' }}>
                    Google Play Store production banner unit ID
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: 4 }}>
                    Google AdSense Publisher ID (Web)
                  </label>
                  <input
                    style={{ width: '100%', margin: 0, fontFamily: 'monospace', fontSize: '0.82rem' }}
                    type="text"
                    value={adSensePublisherId}
                    onChange={(e) => setAdSensePublisherId(e.target.value)}
                    placeholder="ca-pub-3940256099942544"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: 4 }}>
                    Google AdSense Slot ID (Web)
                  </label>
                  <input
                    style={{ width: '100%', margin: 0, fontFamily: 'monospace', fontSize: '0.82rem' }}
                    type="text"
                    value={adSenseSlotId}
                    onChange={(e) => setAdSenseSlotId(e.target.value)}
                    placeholder="6300978111"
                  />
                </div>
              </div>
            </div>

            <button className="btn-primary" type="submit" disabled={savingSystemSettings}>
              {savingSystemSettings ? 'Saving Settings…' : 'Save App, FCM & Google Ads Settings'}
            </button>
          </form>
        </div>

        {/* Account Details Form */}
        <div className="card">
          <h2 className="card-title">Account Details</h2>
          <form onSubmit={handleSaveProfile}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: 4 }}>
                Admin Name
              </label>
              <input
                style={{ width: '100%', margin: 0 }}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter admin name"
                required
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: 4 }}>
                Email Address
              </label>
              <input
                style={{ width: '100%', margin: 0 }}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
              />
            </div>

            <button className="btn-primary" type="submit" disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save Account Changes'}
            </button>
          </form>
        </div>

        {/* Change Password Form */}
        <div className="card">
          <h2 className="card-title">Change Password</h2>
          <form onSubmit={handleChangePassword}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: 4 }}>
                New Password
              </label>
              <input
                style={{ width: '100%', margin: 0 }}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                minLength={6}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: 4 }}>
                Confirm New Password
              </label>
              <input
                style={{ width: '100%', margin: 0 }}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
              />
            </div>

            <button className="btn-primary" type="submit" disabled={savingPassword || !password}>
              {savingPassword ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Identity & Sub-Admin Role Meta */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <h2 className="card-title">System Identity &amp; Role</h2>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <span className="muted" style={{ fontSize: '0.8rem', display: 'block' }}>Phone Number</span>
              <strong>{user.phone}</strong>
            </div>
            <div>
              <span className="muted" style={{ fontSize: '0.8rem', display: 'block' }}>Role Permission</span>
              <span className="badge green" style={{ textTransform: 'capitalize' }}>
                {user.role === 'admin' ? 'Super Admin' : user.role}
              </span>
            </div>
            <div>
              <span className="muted" style={{ fontSize: '0.8rem', display: 'block' }}>Admin ID</span>
              <code style={{ fontSize: '0.85rem', background: '#f4f6f9', padding: '2px 6px', borderRadius: 4 }}>{user.id}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
