import { useEffect, useState } from 'react';
import { triggerHaptic } from '../utils/haptics';

interface AdItem {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  discount: string;
  brand: string;
  badgeText: string;
  icon: string;
  bgGradient: string;
  shadowColor: string;
  ctaText: string;
  targetUrl: string;
}

const AGRI_ADS: AdItem[] = [
  {
    id: 'pesticide-1',
    category: 'Insecticide & Pesticide',
    title: '🐛 Stem Borer & Pest Defense',
    subtitle: 'Protect Paddy, Wheat & Sugarcane from Whiteflies & Borers. 100% Crop Protection!',
    discount: 'UP TO 35% OFF',
    brand: 'KisanCare Bio-Agri',
    badgeText: 'Ad · Insecticides & Pesticides',
    icon: '🛡️',
    bgGradient: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 50%, #43a047 100%)',
    shadowColor: 'rgba(27, 94, 32, 0.28)',
    ctaText: 'Buy Insecticide 📦',
    targetUrl: 'https://www.google.com/search?q=agricultural+insecticide+pesticide+for+crops',
  },
  {
    id: 'crop-seeds-1',
    category: 'High-Yield Seeds',
    title: '🌾 Certified Hybrid Seeds 2026',
    subtitle: 'High-yield Wheat, Paddy, Cotton & Mustard seeds with disease resistance.',
    discount: 'BUY 2 GET 1 FREE',
    brand: 'Google Agri Seeds',
    badgeText: 'Ad · Certified Crop Seeds',
    icon: '🌱',
    bgGradient: 'linear-gradient(135deg, #e65100 0%, #f57c00 50%, #fb8c00 100%)',
    shadowColor: 'rgba(230, 81, 0, 0.28)',
    ctaText: 'Explore Seeds 🌾',
    targetUrl: 'https://www.google.com/search?q=high+yield+hybrid+paddy+wheat+seeds+farmers',
  },
  {
    id: 'fertilizer-1',
    category: 'Fertilizers & Nutrients',
    title: '💧 Nano NPK Liquid & Zinc Boost',
    subtitle: 'Fast absorption liquid fertilizer spray for greener leaves and maximum grain weight.',
    discount: 'FREE DELIVERY',
    brand: 'Iffco Bio-Fertilizers',
    badgeText: 'Ad · Crop Nutrition',
    icon: '🧪',
    bgGradient: 'linear-gradient(135deg, #006064 0%, #00838f 50%, #00acc1 100%)',
    shadowColor: 'rgba(0, 96, 100, 0.28)',
    ctaText: 'Order Fertilizer 🚚',
    targetUrl: 'https://www.google.com/search?q=bio+fertilizer+npk+liquid+spray+farmers',
  },
  {
    id: 'agri-machinery-1',
    category: 'Solar Tubewell & Spraying',
    title: '☀️ Solar Water Pump & Drip Kit',
    subtitle: '80% Govt Subsidy on Solar Tubewell Pumps & Battery Crop Sprayers.',
    discount: '80% GOVT SUBSIDY',
    brand: 'Kisan Solar Power',
    badgeText: 'Ad · Agri Machinery',
    icon: '🚜',
    bgGradient: 'linear-gradient(135deg, #4a148c 0%, #6a1b9a 50%, #8e24aa 100%)',
    shadowColor: 'rgba(74, 20, 140, 0.28)',
    ctaText: 'Apply Subsidy ⚡',
    targetUrl: 'https://www.google.com/search?q=solar+water+pump+subsidy+farmers',
  },
];

interface Props {
  adClient?: string; // Optional Google AdSense client ID e.g. "ca-pub-XXXXXXXXXXXXXXXX"
  adSlot?: string;   // Optional Google AdSense slot ID
}

export function GoogleAgriAds({ adClient, adSlot }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [closed, setClosed] = useState(false);

  // Auto rotate ads every 8 seconds
  useEffect(() => {
    if (closed) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % AGRI_ADS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [closed]);

  // Inject Google AdSense script if client & slot are provided
  useEffect(() => {
    if (!adClient || !adSlot) return;
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* ignore script load issues */
    }
  }, [adClient, adSlot]);

  if (closed) return null;

  const currentAd = AGRI_ADS[currentIndex];

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    setCurrentIndex((prev) => (prev + 1) % AGRI_ADS.length);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    setCurrentIndex((prev) => (prev - 1 + AGRI_ADS.length) % AGRI_ADS.length);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('medium');
    setClosed(true);
  };

  const handleAdClick = () => {
    triggerHaptic('light');
    window.open(currentAd.targetUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      onClick={handleAdClick}
      style={{
        background: currentAd.bgGradient,
        borderRadius: 24,
        padding: '18px 20px',
        color: '#ffffff',
        boxShadow: `0 12px 30px ${currentAd.shadowColor}`,
        marginBottom: 16,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
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

      {/* Real Google AdSense Slot Container (If adClient & adSlot are set) */}
      {adClient && adSlot ? (
        <div style={{ background: '#fff', borderRadius: 16, padding: 8, textAlign: 'center', color: '#333' }}>
          <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: 4 }}>Sponsored · Google Ads</div>
          <ins
            className="adsbygoogle"
            style={{ display: 'block' }}
            data-ad-client={adClient}
            data-ad-slot={adSlot}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      ) : (
        /* Widget Content matching Weather Widget Layout */
        <>
          {/* Top Bar: Ad Badge + Slide Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.24)',
                  border: '1px solid rgba(255, 255, 255, 0.35)',
                  borderRadius: 14,
                  padding: '3px 8px',
                  color: '#fff',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {currentAd.badgeText}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                onClick={handlePrev}
                title="Previous Ad"
                style={{
                  background: 'rgba(255, 255, 255, 0.24)',
                  border: '1px solid rgba(255, 255, 255, 0.35)',
                  color: '#fff',
                  borderRadius: '50%',
                  width: 26,
                  height: 26,
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ‹
              </button>
              <button
                type="button"
                onClick={handleNext}
                title="Next Ad"
                style={{
                  background: 'rgba(255, 255, 255, 0.24)',
                  border: '1px solid rgba(255, 255, 255, 0.35)',
                  color: '#fff',
                  borderRadius: '50%',
                  width: 26,
                  height: 26,
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ›
              </button>
              <button
                type="button"
                onClick={handleClose}
                title="Close Widget"
                style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '50%',
                  width: 22,
                  height: 22,
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 4,
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0 12px' }}>
            <div style={{ flex: 1, paddingRight: 10 }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                {currentAd.title}
              </div>
              <div style={{ fontSize: '0.84rem', opacity: 0.92, fontWeight: 600, marginTop: 4, lineHeight: 1.3 }}>
                {currentAd.subtitle}
              </div>
            </div>

            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: '3rem', lineHeight: 1, filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.18))' }}>
                {currentAd.icon}
              </div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, opacity: 0.88, marginTop: 2 }}>
                {currentAd.brand}
              </div>
            </div>
          </div>

          {/* Bottom Bar: Discount Pill & CTA Button matching Weather Widget glassmorphism */}
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
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 900,
                background: '#ffd54f',
                color: '#212121',
                padding: '3px 10px',
                borderRadius: 10,
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }}
            >
              🔥 {currentAd.discount}
            </span>
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 800,
                background: '#ffffff',
                color: '#1b5e20',
                padding: '4px 12px',
                borderRadius: 10,
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>{currentAd.ctaText}</span>
            </span>
          </div>

          {/* Carousel Dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 10 }}>
            {AGRI_ADS.map((ad, idx) => (
              <div
                key={ad.id}
                style={{
                  width: idx === currentIndex ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: idx === currentIndex ? '#ffffff' : 'rgba(255, 255, 255, 0.35)',
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default GoogleAgriAds;
