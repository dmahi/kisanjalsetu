import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCurrentCoordinates } from '../utils/geolocation';
import { triggerHaptic } from '../utils/haptics';
import { useLocale } from '../store/locale.store';

interface WeatherData {
  temperature: number;
  windspeed: number;
  weathercode: number;
  humidity?: number;
  locationName: string;
}

interface Props {
  tubewellName?: string;
}

export function CurrentLocationWeather({ tubewellName }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useLocale((s) => s.t);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<'C' | 'F'>('C');

  const weatherDetailsPath = location.pathname.startsWith('/owner') ? '/owner/weather' : '/farmer/weather';

  const fetchWeatherForCoords = async (lat: number, lng: number) => {
    try {
      // 1. Open-Meteo Weather API
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&hourly=relativehumidity_2m&timezone=auto`,
      );
      const data = await res.json();

      // 2. Reverse Geocode for Village / District Name
      let place = tubewellName || 'My Location';
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=11`,
        );
        const geoData = await geoRes.json();
        if (geoData?.address) {
          const v =
            geoData.address.village ||
            geoData.address.hamlet ||
            geoData.address.town ||
            geoData.address.city ||
            geoData.address.county ||
            geoData.address.state_district ||
            '';
          const state = geoData.address.state || '';
          if (v) place = state ? `${v}, ${state.substring(0, 2).toUpperCase()}` : v;
        }
      } catch {
        /* fallback place name */
      }

      const curr = data?.current_weather;
      if (curr) {
        setWeather({
          temperature: Math.round(curr.temperature),
          windspeed: Math.round(curr.windspeed),
          weathercode: curr.weathercode ?? 0,
          humidity: data?.hourly?.relativehumidity_2m?.[0] ?? 76,
          locationName: place,
        });
      }
    } catch {
      // Fallback offline / static weather
      setWeather({
        temperature: 28,
        windspeed: 12,
        weathercode: 1,
        humidity: 82,
        locationName: tubewellName || 'Bekasi Timur',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadLocationWeather = async () => {
    setLoading(true);
    const coords = await getCurrentCoordinates();
    if (coords) {
      void fetchWeatherForCoords(coords.latitude, coords.longitude);
    } else {
      // Fallback default farm coords
      void fetchWeatherForCoords(28.6139, 77.209);
    }
  };

  useEffect(() => {
    void loadLocationWeather();
  }, [tubewellName]);

  const getWeatherIcon = (code: number) => {
    if (code === 0) return { icon: '☀️', text: t('weather_sunny') };
    if (code >= 1 && code <= 3) return { icon: '⛅', text: t('weather_partly_cloudy') };
    if (code >= 45 && code <= 48) return { icon: '🌫️', text: t('weather_foggy') };
    if (code >= 51 && code <= 82) return { icon: '🌧️', text: t('weather_cloudy_rain') };
    if (code >= 95) return { icon: '🌩️', text: 'Thunderstorm' };
    return { icon: '🌤️', text: t('weather_clear') };
  };

  const getAgriAdvice = (code: number, temp: number) => {
    if (code >= 51 && code <= 82) return `🌧️ ${t('advisory_rain', { rainProb: 75, dayName: t('today') })}`;
    if (code >= 95) return `🌩️ ${t('weather_thunderstorm')} - ${t('advisory_rain', { rainProb: 90, dayName: t('today') })}`;
    if (temp > 38) return `🔥 ${t('advisory_heat', { maxTemp: temp })}`;
    return `🌱 ${t('advisory_clear')}`;
  };

  const displayTemp = weather
    ? unit === 'C'
      ? weather.temperature
      : Math.round((weather.temperature * 9) / 5 + 32)
    : 28;

  const info = getWeatherIcon(weather?.weathercode ?? 1);

  return (
    <div
      onClick={() => {
        triggerHaptic('light');
        navigate(weatherDetailsPath);
      }}
      style={{
        background: 'linear-gradient(135deg, #0288d1 0%, #039be5 50%, #29b6f6 100%)',
        borderRadius: 24,
        padding: '18px 20px',
        color: '#ffffff',
        boxShadow: '0 12px 30px rgba(2, 136, 209, 0.28)',
        marginBottom: 16,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.18s ease, boxShadow 0.18s ease',
      }}
    >
      {/* Background radial glow */}
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

      {/* Top Bar: Location + Unit Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: '0.86rem', opacity: 0.92, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>📍</span>
          <span>
            {weather?.locationName || 'Current Location'}, {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            triggerHaptic('light');
            setUnit((u) => (u === 'C' ? 'F' : 'C'));
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.24)',
            border: '1px solid rgba(255, 255, 255, 0.35)',
            borderRadius: 14,
            padding: '3px 8px',
            color: '#fff',
            fontSize: '0.76rem',
            fontWeight: 800,
            cursor: 'pointer',
          }}
          title="Toggle Celcius / Fahrenheit"
        >
          °{unit}
        </button>
      </div>

      {/* Main Temperature & Weather Icon */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 10px' }}>
        <div>
          <div style={{ fontSize: '2.4rem', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {loading ? '...' : `${displayTemp}°${unit}`}
          </div>
          <div style={{ fontSize: '0.88rem', opacity: 0.94, fontWeight: 600, marginTop: 4 }}>
            {t('humidity')} {weather?.humidity ?? 82}% · {t('wind')} {weather?.windspeed ?? 12} km/h
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '3.2rem', lineHeight: 1, filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.18))' }}>
            {info.icon}
          </div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, opacity: 0.9, marginTop: 2 }}>
            {info.text}
          </div>
        </div>
      </div>

      {/* Agricultural Advice Banner & 7-Day Forecast Click Indicator */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.22)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderRadius: 14,
          padding: '10px 14px',
          fontSize: '0.83rem',
          fontWeight: 600,
          border: '1px solid rgba(255, 255, 255, 0.28)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span style={{ flex: 1 }}>{getAgriAdvice(weather?.weathercode ?? 0, weather?.temperature ?? 28)}</span>
        <span style={{ fontSize: '0.76rem', fontWeight: 800, background: 'rgba(255,255,255,0.3)', padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>
          {t('seven_day_guide')}
        </span>
      </div>
    </div>
  );
}

export default CurrentLocationWeather;
