import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Layers } from 'lucide-react';

/**
 * Free basemaps — none of these need an API key or account.
 *   Satellite : Esri World Imagery (best for spotting tidal flats and creeks)
 *   Dark      : CARTO Dark Matter  (matches the console UI, good for overlays)
 *   Streets   : OpenStreetMap standard tiles
 * Swap in MapTiler / Stadia / Thunderforest here if you later want a keyed provider.
 */
export const BASEMAPS = {
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  dark: {
    label: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 20,
  },
  streets: {
    label: 'Streets',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
};

/** Fits the map to a GeoJSON geometry whenever it changes. */
export function FitTo({ geometry, padding = 30, maxZoom = 17 }) {
  const map = useMap();
  useEffect(() => {
    if (!geometry) return;
    try {
      const bounds = L.geoJSON(geometry).getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [padding, padding], maxZoom, animate: true });
      }
    } catch {
      /* geometry not renderable yet */
    }
  }, [map, geometry, padding, maxZoom]);
  return null;
}

/** Keeps Leaflet's internal size in sync when its container is resized. */
function ResizeWatcher() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  }, [map]);
  return null;
}

function BasemapSwitcher({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute right-3 top-3 z-[420]">
      <div className="overflow-hidden rounded-xl border border-white/12 bg-abyss-950/85 shadow-panel backdrop-blur">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Change basemap"
          className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs font-semibold
                     text-slate-200 transition hover:bg-white/8"
        >
          <Layers size={14} aria-hidden />
          {BASEMAPS[value].label}
        </button>
        {open && (
          <ul className="border-t border-white/10">
            {Object.entries(BASEMAPS).map(([key, map]) => (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                  className={`w-full cursor-pointer px-3 py-2 text-left text-xs transition hover:bg-white/8
                    ${key === value ? 'text-tide-300' : 'text-slate-300'}`}
                >
                  {map.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Shared map shell. Children are rendered inside the Leaflet context, so any
 * react-leaflet layer (GeoJSON, Marker, ...) can be dropped in directly.
 */
export default function MapCanvas({
  center = [21.9, 88.6],
  zoom = 13,
  basemap = 'satellite',
  className = 'h-[520px]',
  children,
  legend,
  showSwitcher = true,
  mapRef,
}) {
  const [active, setActive] = useState(basemap);
  const tiles = useMemo(() => BASEMAPS[active], [active]);

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 ${className}`}>
      <MapContainer
        ref={mapRef}
        center={center}
        zoom={zoom}
        scrollWheelZoom
        zoomControl
        className="h-full w-full"
        attributionControl
      >
        <TileLayer key={active} url={tiles.url} attribution={tiles.attribution} maxZoom={tiles.maxZoom} />
        <ResizeWatcher />
        {children}
      </MapContainer>

      {showSwitcher && <BasemapSwitcher value={active} onChange={setActive} />}

      {legend && (
        <div
          className="pointer-events-none absolute bottom-3 left-3 z-[420] rounded-xl border border-white/12
                     bg-abyss-950/85 px-3 py-2.5 shadow-panel backdrop-blur"
        >
          {legend}
        </div>
      )}
    </div>
  );
}

export function LegendRow({ color, children }) {
  return (
    <span className="flex items-center gap-2 text-[11px] text-slate-300">
      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} aria-hidden />
      {children}
    </span>
  );
}
