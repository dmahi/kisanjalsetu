import { useState } from 'react';
import { Camera, Trash2, Save } from 'lucide-react';
import { authApi } from '../api/auth';
import { apiErrorMessage } from '../api/client';
import { useAuthStore } from '../store/auth.store';
import { useLocale } from '../store/locale.store';
import { UserAvatar } from './UserAvatar';
import { Card, useToast } from './ui';
import { capturePhoto } from '../utils/camera';
import { dataUrlToSquare } from '../utils/avatar';
import { triggerHapticSelection } from '../utils/haptics';

/** Profile photo + basic detail editor. The photo is optional — a user can
 *  update name/email without ever adding an image. */
export default function EditProfile() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const t = useLocale((s) => s.t);
  const { show } = useToast();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [photo, setPhoto] = useState(user?.profileImage ?? '');
  const [saving, setSaving] = useState(false);

  const choosePhoto = async () => {
    const dataUrl = await capturePhoto('photos');
    if (!dataUrl) return;
    try {
      setPhoto(await dataUrlToSquare(dataUrl, 256));
    } catch {
      setPhoto(dataUrl);
    }
  };

  const save = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      show(t('name_required'), 'error');
      return;
    }
    setSaving(true);
    try {
      triggerHapticSelection();
      const fresh = await authApi.updateProfile({
        name: cleanName,
        email: email.trim() || undefined,
        profileImage: photo,
      });
      setUser(fresh);
      show(t('profile_saved'), 'success');
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={t('edit_profile')}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '6px 0 14px' }}>
        <UserAvatar user={{ ...user, profileImage: photo || null } as typeof user} size={92} onDark={false} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm btn-secondary" onClick={() => void choosePhoto()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Camera size={16} />
            <span>{t('change_photo')}</span>
          </button>
          {photo ? (
            <button className="btn btn-sm btn-ghost" onClick={() => setPhoto('')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Trash2 size={16} />
              <span>{t('remove_photo')}</span>
            </button>
          ) : null}
        </div>
        <span className="muted" style={{ fontSize: '0.78rem' }}>{t('photo_optional')}</span>
      </div>

      <label>{t('full_name')}</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('your_name_hint')} maxLength={100} />

      <label>{t('email')} <span className="muted" style={{ fontWeight: 400 }}>· {t('optional')}</span></label>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" maxLength={120} />

      <button className="btn btn-primary mt" disabled={saving} onClick={() => void save()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Save size={18} />
        <span>{saving ? t('saving') : t('save')}</span>
      </button>
    </Card>
  );
}