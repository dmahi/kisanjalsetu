import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { useAuthStore } from '../../store/auth.store';
import { ownerApi } from '../../api/owner';
import { apiErrorMessage, toFileUrl, uploadImage } from '../../api/client';
import { PageHeader, Card, useToast, Segmented } from '../../components/ui';
import { useLocale } from '../../store/locale.store';

const MAX_PHOTOS = 4;

type PumpType = 'motor_pump' | 'submersible_pump';

export default function BecomeOwner() {
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const t = useLocale((s) => s.t);
  const { show, toast } = useToast();

  const [profileImage, setProfileImage] = useState(user?.profileImage ?? '');
  const [name, setName] = useState('');
  const [type, setType] = useState<PumpType>('motor_pump');
  const [rate, setRate] = useState('');
  const [village, setVillage] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('India');
  const [pincode, setPincode] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState<'photo' | 'gps' | 'submit' | null>(null);

  useEffect(() => {
    if (user?.role !== 'farmer') {
      navigate('/farmer/home', { replace: true });
    }
  }, [user, navigate]);

  const takeProfilePhoto = async () => {
    setBusy('photo');
    try {
      const shot = await Camera.getPhoto({
        resultType: CameraResultType.Base64,
        source: CameraSource.Prompt,
        quality: 80,
        width: 800,
        correctOrientation: true,
      });
      if (shot.base64String) {
        const blob = base64ToBlob(shot.base64String, shot.format || 'image/jpeg');
        const path = await uploadImage(blob, `profile.${extFor(shot.format || 'jpeg')}`);
        setProfileImage(path);
      }
    } catch (err) {
      show((err as Error)?.message?.includes('cancel') ? '' : t('photo_error'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const addTubewellPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    setBusy('photo');
    try {
      const shot = await Camera.getPhoto({
        resultType: CameraResultType.Base64,
        source: CameraSource.Prompt,
        quality: 70,
        width: 1200,
        correctOrientation: true,
      });
      if (shot.base64String) {
        const blob = base64ToBlob(shot.base64String, shot.format || 'image/jpeg');
        const path = await uploadImage(blob, `tubewell.${extFor(shot.format || 'jpeg')}`);
        setPhotos((p) => [...p, path]);
      }
    } catch (err) {
      show((err as Error)?.message?.includes('cancel') ? '' : t('photo_error'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const useMyLocation = async () => {
    setBusy('gps');
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
      setLatitude(pos.coords.latitude.toFixed(6));
      setLongitude(pos.coords.longitude.toFixed(6));
      show(t('location_updated'), 'success');
    } catch {
      show(t('gps_error'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    const rateNum = parseFloat(rate);
    if (!name.trim() || !rateNum || rateNum <= 0) {
      show(t('required_missing'), 'error');
      return;
    }
    setBusy('submit');
    try {
      const result = await ownerApi.becomeOwner({
        name: name.trim(),
        type,
        ratePerHourPaise: Math.round(rateNum * 100),
        address: address.trim(),
        village: village.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        country: country.trim() || undefined,
        pincode: pincode.trim() || undefined,
        description: description.trim() || undefined,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        images: photos.length ? photos : undefined,
        profileImage: profileImage || undefined,
      });
      await login(result.token, result.user);
      show(t('become_owner_success'), 'success');
      navigate('/owner/dashboard', { replace: true });
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page">
      {toast}
      <PageHeader title={t('become_owner')} subtitle={t('become_owner_hint')} />

      <Card title={t('your_photo')}>
        <div className="owner-profile-photo">
          <div className="avatar-btn" onClick={takeProfilePhoto}>
            {profileImage ? (
              <img src={toFileUrl(profileImage)} alt="profile" />
            ) : (
              <span>{busy === 'photo' ? '…' : '+ 📷'}</span>
            )}
          </div>
          <p className="muted" style={{ fontSize: '0.85rem' }}>{t('your_photo_hint')}</p>
        </div>
      </Card>

      <Card title={t('tubewell_details')}>
        <label className="field-label">{t('tubewell_name')}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('tubewell_name_hint')} />

        <label className="field-label">{t('tubewell_type')}</label>
        <Segmented
          options={[
            { label: t('motor_pump'), value: 'motor_pump' },
            { label: t('submersible_pump'), value: 'submersible_pump' },
          ]}
          value={type}
          onChange={(v: PumpType) => setType(v)}
        />

        <label className="field-label">{t('rate_per_hour_rs')} (₹)</label>
        <input
          inputMode="decimal"
          value={rate}
          onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder="e.g. 150"
        />
      </Card>

      <Card title={t('location_section')}>
        <label className="field-label">{t('place')}</label>
        <input value={village} onChange={(e) => setVillage(e.target.value)} placeholder={t('place_hint')} />

        <label className="field-label">{t('address')}</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t('address_hint')} />

        <div className="field-grid">
          <div>
            <label className="field-label">{t('location_city')}</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <label className="field-label">{t('location_state')}</label>
            <input value={state} onChange={(e) => setState(e.target.value)} />
          </div>
        </div>

        <div className="field-grid">
          <div>
            <label className="field-label">{t('location_country')}</label>
            <input value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
          <div>
            <label className="field-label">{t('location_pincode')}</label>
            <input inputMode="numeric" maxLength={10} value={pincode} onChange={(e) => setPincode(e.target.value.replace(/[^0-9]/g, ''))} />
          </div>
        </div>

        <label className="field-label">{t('lat')} / {t('lng')} <span className="muted">({t('optional')})</span></label>
        <div className="gps-row">
          <input inputMode="decimal" value={latitude} onChange={(e) => setLatitude(e.target.value.replace(/[^0-9.\-]/g, ''))} placeholder={t('lat')} />
          <input inputMode="decimal" value={longitude} onChange={(e) => setLongitude(e.target.value.replace(/[^0-9.\-]/g, ''))} placeholder={t('lng')} />
          <button type="button" className="btn btn-secondary btn-sm" onClick={useMyLocation} disabled={busy === 'gps'}>
            {busy === 'gps' ? t('locating') : `📍 ${t('use_my_location')}`}
          </button>
        </div>
      </Card>

      <Card title={t('tubewell_photos')} action={<span className="muted" style={{ fontSize: '0.8rem' }}>{photos.length}/{MAX_PHOTOS}</span>}>
        <div className="photo-grid">
          {photos.map((p) => (
            <div key={p} className="photo-tile">
              <img src={toFileUrl(p)} alt="tubewell" />
              <button
                type="button"
                className="photo-remove"
                onClick={() => setPhotos((arr) => arr.filter((x) => x !== p))}
                aria-label="remove"
              >
                ×
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button type="button" className="photo-tile add" onClick={addTubewellPhoto} disabled={busy === 'photo'}>
              {busy === 'photo' ? '…' : '+ 📷'}
              <span className="muted" style={{ fontSize: '0.75rem' }}>{t('add_photo')}</span>
            </button>
          )}
        </div>
      </Card>

      <Card title={t('description')}>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('description_optional')}
        />
      </Card>

      <button className="btn btn-primary btn-lg" onClick={submit} disabled={busy === 'submit'}>
        {busy === 'submit' ? t('creating') : `🚜 ${t('become_owner_submit')}`}
      </button>
    </div>
  );
}

function base64ToBlob(base64: string, mime: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function extFor(format: string): string {
  if (format === 'png') return 'png';
  if (format === 'webp') return 'webp';
  return 'jpg';
}