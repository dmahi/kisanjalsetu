import { LOCALES, Locale } from '../i18n/translations';
import { useLocale } from '../store/locale.store';

export function LanguageSelectorPill() {
  const locale = useLocale((s) => s.locale);
  const setLocale = useLocale((s) => s.setLocale);

  return (
    <div className="lang-pill-bar" aria-label="Select Language">
      {Object.values(LOCALES).map((loc) => {
        const active = loc.code === locale;
        return (
          <button
            key={loc.code}
            className={`lang-pill-btn ${active ? 'active' : ''}`}
            onClick={() => setLocale(loc.code as Locale)}
            title={`Switch language to ${loc.label}`}
          >
            {loc.code === 'hi' ? '🇮🇳 हिंदी' : loc.code === 'pa' ? '🇮🇳 ਪੰਜਾਬੀ' : '🇬🇧 EN'}
          </button>
        );
      })}
    </div>
  );
}
