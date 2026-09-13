import { useEffect, useRef, useState } from 'react';
import { getCurrentCoordinates } from '../utils/geolocation';
import { triggerHaptic } from '../utils/haptics';

interface MapPinPickerProps {
  initialLocation?: string;
  onSelectLocation: (locationStr: string) => void;
  onClose: () => void;
}

declare global {
  interface Window {
    L: any;
  }
}

export default function MapPinPicker({
  initialLocation,
  onSelectLocation,
  onClose,
}: MapPinPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  // Parse initial coordinates if available
  const parseCoords = (locStr?: string): [number, number] => {
    if (locStr) {
      const parts = locStr.split(',').map((p) => parseFloat(p.trim()));
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return [parts[0], parts[1]];
      }
    }
    // Default fallback (India farm zone)
    return [28.6139, 77.209];
  };

  const [coords, setCoords] = useState<[number, number]>(parseCoords(initialLocation));
  const [villageName, setVillageName] = useState<string>('');
  const [mapMode, setMapMode] = useState<'hybrid' | 'street'>('hybrid'); // Default to Hybrid Satellite Field + Place/Village Names
  const [isMoving, setIsMoving] = useState(false);
  const [loadingGps, setLoadingGps] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Reverse geocode lat,lng to fetch Village / Tehsil name
  const fetchVillageName = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`,
      );
      const data = await res.json();
      if (data && data.address) {
        const v =
          data.address.village ||
          data.address.hamlet ||
          data.address.suburb ||
          data.address.town ||
          data.address.county ||
          data.address.state_district ||
          '';
        if (v) {
          setVillageName(v);
        }
      }
    } catch {
      /* ignore reverse geocode network issues */
    }
  };

  // Load Leaflet CSS and JS dynamically if needed
  useEffect(() => {
    let isMounted = true;

    const loadLeaflet = async () => {
      // 1. Inject Leaflet CSS if not already present
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // 2. Load Leaflet JS script if window.L is not available
      if (window.L) {
        if (isMounted) setMapLoaded(true);
        return;
      }

      if (!document.getElementById('leaflet-js')) {
        const script = document.createElement('script');
        script.id = 'leaflet-js';
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => {
          if (isMounted) setMapLoaded(true);
        };
        document.head.appendChild(script);
      } else {
        const checkInterval = setInterval(() => {
          if (window.L) {
            clearInterval(checkInterval);
            if (isMounted) setMapLoaded(true);
          }
        }, 100);
      }
    };

    void loadLeaflet();

    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize Leaflet Map once loaded
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || leafletMapRef.current) return;

    const L = window.L;
    const initialPos = coords;

    const map = L.map(mapRef.current, {
      center: initialPos,
      zoom: 17,
      zoomControl: true,
    });

    // 1. Satellite Base Layer (Esri World Imagery)
    const satelliteTile = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Satellite Imagery © Esri, Maxar',
      },
    );

    // 2. Place Names & Boundaries Layer (Esri)
    const esriLabelsTile = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
      },
    );

    // 3. CartoDB High-Contrast Village & Locality Labels Layer
    const villageLabelsTile = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 19,
        subdomains: 'abcd',
      },
    );

    // 4. Street Layer
    const streetTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    });

    if (mapMode === 'hybrid') {
      satelliteTile.addTo(map);
      esriLabelsTile.addTo(map);
      villageLabelsTile.addTo(map);
    } else {
      streetTile.addTo(map);
    }

    tileLayerRef.current = {
      satellite: satelliteTile,
      esriLabels: esriLabelsTile,
      villageLabels: villageLabelsTile,
      street: streetTile,
    };
    leafletMapRef.current = map;

    void fetchVillageName(initialPos[0], initialPos[1]);

    // Track map pan/move to update frozen center pin coordinates
    map.on('movestart', () => {
      setIsMoving(true);
    });

    map.on('move', () => {
      const center = map.getCenter();
      setCoords([parseFloat(center.lat.toFixed(6)), parseFloat(center.lng.toFixed(6))]);
    });

    map.on('moveend', () => {
      setIsMoving(false);
      const center = map.getCenter();
      const lat = parseFloat(center.lat.toFixed(6));
      const lng = parseFloat(center.lng.toFixed(6));
      setCoords([lat, lng]);
      triggerHaptic('light');
      void fetchVillageName(lat, lng);
    });

    return () => {
      map.remove();
      leafletMapRef.current = null;
      tileLayerRef.current = null;
    };
  }, [mapLoaded]);

  // Switch between Hybrid Satellite Field View (with Village Names) and Street View
  const toggleMapMode = (mode: 'hybrid' | 'street') => {
    triggerHaptic('light');
    setMapMode(mode);
    if (!leafletMapRef.current || !tileLayerRef.current) return;
    const map = leafletMapRef.current;
    const { satellite, esriLabels, villageLabels, street } = tileLayerRef.current;

    map.eachLayer((layer: any) => {
      map.removeLayer(layer);
    });

    if (mode === 'hybrid') {
      satellite.addTo(map);
      esriLabels.addTo(map);
      villageLabels.addTo(map);
    } else {
      street.addTo(map);
    }
  };

  const handleCenterGps = async () => {
    setLoadingGps(true);
    triggerHaptic('medium');
    const gps = await getCurrentCoordinates();
    setLoadingGps(false);
    if (gps && leafletMapRef.current) {
      const newPos: [number, number] = [
        parseFloat(gps.latitude.toFixed(6)),
        parseFloat(gps.longitude.toFixed(6)),
      ];
      setCoords(newPos);
      leafletMapRef.current.setView(newPos, 17);
      triggerHaptic('heavy');
      void fetchVillageName(newPos[0], newPos[1]);
    }
  };

  const handleConfirm = () => {
    triggerHaptic('heavy');
    const locStr = `${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}`;
    onSelectLocation(locStr);
    onClose();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
      {/* Top Header Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--brand-soft)',
          padding: '10px 14px',
          borderRadius: 14,
        }}
      >
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-700)', textTransform: 'uppercase' }}>
            {villageName ? `🏡 Village: ${villageName}` : 'Center Field Pin Location'}
          </div>
          <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#0b1c12', marginTop: 2 }}>
            📍 {coords[0].toFixed(5)}, {coords[1].toFixed(5)}
          </div>
        </div>

        <button
          type="button"
          className="btn btn-sm btn-ghost"
          style={{ background: '#fff', borderRadius: 20 }}
          onClick={() => void handleCenterGps()}
          disabled={loadingGps}
        >
          {loadingGps ? '🛰️ Locating...' : '🎯 My GPS'}
        </button>
      </div>

      {/* Layer Toggle: Satellite Field + Village Names vs Street */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
        <button
          type="button"
          className={`preset-chip ${mapMode === 'hybrid' ? 'active' : ''}`}
          style={{ padding: '6px 14px', fontSize: '0.82rem', flex: 1 }}
          onClick={() => toggleMapMode('hybrid')}
        >
          🌾 Fields + Village Names
        </button>
        <button
          type="button"
          className={`preset-chip ${mapMode === 'street' ? 'active' : ''}`}
          style={{ padding: '6px 14px', fontSize: '0.82rem', flex: 1 }}
          onClick={() => toggleMapMode('street')}
        >
          🗺️ Street Map
        </button>
      </div>

      {/* Map Canvas Container with Frozen Center Pin */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '330px',
          borderRadius: 18,
          overflow: 'hidden',
          border: '2.5px solid var(--brand-500)',
          boxShadow: '0 4px 18px rgba(4,106,56,0.18)',
        }}
      >
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {/* Frozen Center Pin Point */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -100%)',
            zIndex: 1000,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontSize: '2.5rem',
              lineHeight: 1,
              filter: isMoving
                ? 'drop-shadow(0 12px 10px rgba(0,0,0,0.4))'
                : 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))',
              transform: isMoving ? 'translateY(-8px) scale(1.12)' : 'translateY(0) scale(1)',
              transition: 'transform 0.15s ease, filter 0.15s ease',
            }}
          >
            📍
          </div>
          <div
            style={{
              width: 10,
              height: 4,
              background: 'rgba(0,0,0,0.4)',
              borderRadius: '50%',
              marginTop: -2,
              filter: 'blur(1px)',
            }}
          />
        </div>

        {!mapLoaded && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: '#f8faf9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: '0.9rem',
              fontWeight: 700,
              color: 'var(--ink-soft)',
            }}
          >
            <div className="spinner" /> Loading Field Satellite & Village Names...
          </div>
        )}
      </div>

      <p style={{ fontSize: '0.8rem', color: '#688273', margin: '2px 0', textAlign: 'center' }}>
        🖐️ Move/drag the satellite map to position your <b>farm field</b> under the <b>Center Pin 📍</b>!
      </p>

      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onClose}
          style={{ flex: 1 }}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleConfirm}
          style={{ flex: 2, borderRadius: 16 }}
        >
          ✅ Set Field Location
        </button>
      </div>
    </div>
  );
}


