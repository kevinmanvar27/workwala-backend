'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Search, Loader2, X } from 'lucide-react';

// ── TYPES ──────────────────────────────────────────────────────────────────────
interface ServiceAreaMapProps {
  latitude?: number;
  longitude?: number;
  radius?: number;
  onLocationChange: (lat: number, lng: number) => void;
  onRadiusChange?: (radius: number) => void;
  readonly?: boolean;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function ServiceAreaMap({
  latitude = 22.2735,
  longitude = 70.7513,
  radius = 5000,
  onLocationChange,
  onRadiusChange,
  readonly = false,
}: ServiceAreaMapProps) {
  const mapRef        = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef      = useRef<any>(null);
  const circleRef      = useRef<any>(null);
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initedRef      = useRef(false); // guard against double-init in StrictMode

  const [isLoading,    setIsLoading]    = useState(true);
  const [loadError,    setLoadError]    = useState<string | null>(null);
  const [localRadius,  setLocalRadius]  = useState(radius);

  // Nominatim search state
  const [searchQuery,  setSearchQuery]  = useState('');
  const [suggestions,  setSuggestions]  = useState<NominatimResult[]>([]);
  const [searching,    setSearching]    = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // ── INIT MAP ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (initedRef.current) return;   // already ran
    if (!mapRef.current) return;

    initedRef.current = true;

    // Leaflet must be imported dynamically because it accesses `window` on import
    Promise.all([
      import('leaflet'),
    ]).then(([L]) => {
      if (!mapRef.current) return;

      // Fix broken default marker icons when bundled
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // Create map
      const map = L.map(mapRef.current!, {
        center:        [latitude, longitude],
        zoom:          13,
        zoomControl:   true,
        scrollWheelZoom: true,
      });

      // OSM tile layer — completely free, no key needed
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Marker
      const marker = L.marker([latitude, longitude], { draggable: !readonly }).addTo(map);

      // Radius circle
      const circle = L.circle([latitude, longitude], {
        radius:      localRadius,
        color:       '#4A2372',
        weight:      2,
        opacity:     0.8,
        fillColor:   '#4A2372',
        fillOpacity: 0.15,
      }).addTo(map);

      if (!readonly) {
        // Drag marker
        marker.on('dragend', () => {
          const { lat, lng } = marker.getLatLng();
          circle.setLatLng([lat, lng]);
          onLocationChange(lat, lng);
        });

        // Click on map to move marker
        map.on('click', (e: any) => {
          const { lat, lng } = e.latlng;
          marker.setLatLng([lat, lng]);
          circle.setLatLng([lat, lng]);
          onLocationChange(lat, lng);
        });
      }

      mapInstanceRef.current = map;
      markerRef.current      = marker;
      circleRef.current      = circle;

      setIsLoading(false);

      // CRITICAL: invalidateSize after the modal finishes its CSS transition.
      // Without this, Leaflet measures 0×0 and tiles render outside the box.
      requestAnimationFrame(() => {
        map.invalidateSize({ animate: false });
      });
      // Second pass — catches slower modal open animations
      setTimeout(() => {
        map.invalidateSize({ animate: false });
      }, 300);

    }).catch(() => {
      setLoadError('Failed to load map.');
      setIsLoading(false);
    });

    return () => {
      // Destroy map on unmount to avoid "map container already initialised" error
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current      = null;
        circleRef.current      = null;
        initedRef.current      = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── SYNC lat/lng props → map ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current || !circleRef.current) return;
    const pos: [number, number] = [latitude, longitude];
    markerRef.current.setLatLng(pos);
    circleRef.current.setLatLng(pos);
    mapInstanceRef.current.setView(pos, mapInstanceRef.current.getZoom(), { animate: false });
  }, [latitude, longitude]);

  // ── SYNC radius prop → local state ────────────────────────────────────────
  useEffect(() => { setLocalRadius(radius); }, [radius]);

  // ── SYNC local radius → circle ────────────────────────────────────────────
  useEffect(() => {
    circleRef.current?.setRadius(localRadius);
  }, [localRadius]);

  // ── NOMINATIM SEARCH ──────────────────────────────────────────────────────
  const handleSearchInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    setSuggestions([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 3) { setShowDropdown(false); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=in&limit=6&addressdetails=0`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data: NominatimResult[] = await res.json();
        setSuggestions(data);
        setShowDropdown(data.length > 0);
      } catch {
        // ignore network errors silently
      } finally {
        setSearching(false);
      }
    }, 400);
  }, []);

  const handleSuggestionClick = useCallback((result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const pos: [number, number] = [lat, lng];

    if (markerRef.current && circleRef.current && mapInstanceRef.current) {
      markerRef.current.setLatLng(pos);
      circleRef.current.setLatLng(pos);
      mapInstanceRef.current.setView(pos, 14);
    }

    onLocationChange(lat, lng);
    setSearchQuery(result.display_name.split(',').slice(0, 2).join(', ').trim());
    setShowDropdown(false);
    setSuggestions([]);
  }, [onLocationChange]);

  // ── RADIUS HANDLER ────────────────────────────────────────────────────────
  const handleRadiusChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setLocalRadius(val);
    onRadiusChange?.(val);
  }, [onRadiusChange]);

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* Search */}
      {!readonly && (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchInput}
              onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              placeholder="Search location (e.g. Rajkot, Gujarat)…"
              className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              autoComplete="off"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-purple-500 pointer-events-none" size={15} />
            )}
            {!searching && searchQuery && (
              <button
                type="button"
                onMouseDown={() => { setSearchQuery(''); setSuggestions([]); setShowDropdown(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <ul className="absolute z-[9999] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto">
              {suggestions.map((s) => (
                <li
                  key={s.place_id}
                  onMouseDown={() => handleSuggestionClick(s)}
                  className="flex items-start gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 cursor-pointer border-b border-gray-100 last:border-0"
                >
                  <MapPin size={13} className="text-purple-400 mt-0.5 shrink-0" />
                  <span className="line-clamp-2 leading-snug">{s.display_name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Map */}
      <div className="relative rounded-lg overflow-hidden border border-gray-300" style={{ height: 400 }}>
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-50">
            <Loader2 className="animate-spin text-purple-600 mb-2" size={30} />
            <p className="text-sm text-gray-500">Loading map…</p>
          </div>
        )}
        {loadError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-red-50 p-6">
            <p className="text-sm text-red-600 text-center">{loadError}</p>
          </div>
        )}
        {/* Leaflet mounts here — explicit px height so Leaflet never measures 0 */}
        <div ref={mapRef} style={{ width: '100%', height: '400px' }} />
      </div>

      {/* Radius slider */}
      {!readonly && onRadiusChange && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Coverage Radius: <span className="text-purple-600 font-semibold">{(localRadius / 1000).toFixed(1)} km</span>
          </label>
          <input
            type="range" min="1000" max="50000" step="500"
            value={localRadius} onChange={handleRadiusChange}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>1 km</span><span>50 km</span>
          </div>
        </div>
      )}

      {/* Coordinates + engine badge */}
      <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
        <div className="flex items-center gap-1.5 font-mono">
          <MapPin size={12} className="text-purple-500" />
          <span>{latitude.toFixed(6)}, {longitude.toFixed(6)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span>OpenStreetMap</span>
        </div>
      </div>

      {!readonly && (
        <p className="text-xs text-gray-400 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          <strong className="text-blue-600">Tip:</strong> Click on the map or drag the marker to set the service area center.
        </p>
      )}
    </div>
  );
}
