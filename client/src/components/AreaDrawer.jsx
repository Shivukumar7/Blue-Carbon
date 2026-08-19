import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { Pencil, Trash2, Undo2 } from 'lucide-react';
import { areaHectares } from '../lib/geo.js';

const SHAPE_STYLE = {
  color: '#34D399',
  weight: 2.5,
  fillColor: '#10B981',
  fillOpacity: 0.22,
  dashArray: null,
};

/**
 * Interactive boundary tracer. Mount inside a <MapCanvas>; it draws exactly one
 * polygon at a time and reports it upward as a GeoJSON Polygon.
 */
function DrawLayer({ value, onChange, active }) {
  const map = useMap();
  const layerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Set up geoman once.
  useEffect(() => {
    map.pm.setGlobalOptions({
      snappable: true,
      snapDistance: 18,
      templineStyle: { color: '#6EE7B7', weight: 2 },
      hintlineStyle: { color: '#6EE7B7', dashArray: '5,6', weight: 2 },
      pathOptions: SHAPE_STYLE,
      allowSelfIntersection: false,
    });
    const handleCreate = (e) => {
      if (layerRef.current) map.removeLayer(layerRef.current);
      layerRef.current = e.layer;
      e.layer.setStyle?.(SHAPE_STYLE);
      e.layer.on('pm:edit', () => onChangeRef.current(e.layer.toGeoJSON().geometry));
      e.layer.on('pm:dragend', () => onChangeRef.current(e.layer.toGeoJSON().geometry));
      onChangeRef.current(e.layer.toGeoJSON().geometry);
      map.pm.disableDraw();
    };

    map.on('pm:create', handleCreate);
    return () => {
      map.off('pm:create', handleCreate);
      map.pm.disableDraw();
    };
  }, [map]);

  // Render an externally supplied polygon (e.g. the community's proposed area).
  useEffect(() => {
    if (!value) {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      return;
    }
    if (layerRef.current) return; // user is editing the layer already on the map

    const layer = L.geoJSON(value, { style: SHAPE_STYLE }).getLayers()[0];
    if (!layer) return;
    layer.addTo(map);
    layer.pm.enable({ allowSelfIntersection: false });
    layer.on('pm:edit', () => onChangeRef.current(layer.toGeoJSON().geometry));
    layerRef.current = layer;
  }, [map, value]);

  // Expose the toolbar actions through the map instance for the buttons below.
  useEffect(() => {
    map.__drawer = {
      start: () => map.pm.enableDraw('Polygon'),
      clear: () => {
        if (layerRef.current) {
          map.removeLayer(layerRef.current);
          layerRef.current = null;
        }
        map.pm.disableDraw();
        onChangeRef.current(null);
      },
      undo: () => map.pm?.Draw?.Polygon?._removeLastVertex?.(),
      isDrawing: () => map.pm.globalDrawModeEnabled(),
    };
    return () => {
      delete map.__drawer;
    };
  }, [map]);

  useEffect(() => {
    if (active && !value) map.pm.enableDraw('Polygon');
  }, [map, active, value]);

  return null;
}

export default function AreaDrawer({ value, onChange, autoStart = false }) {
  return <DrawLayer value={value} onChange={onChange} active={autoStart} />;
}

/** Toolbar rendered *outside* the Leaflet context, wired via the map instance. */
export function DrawToolbar({ map, value, onChange, hint }) {
  const ha = value ? areaHectares(value) : 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn-primary"
        onClick={() => map?.__drawer?.start()}
        disabled={!map}
      >
        <Pencil size={15} aria-hidden />
        {value ? 'Redraw boundary' : 'Draw boundary'}
      </button>
      <button
        type="button"
        className="btn-ghost"
        onClick={() => map?.__drawer?.undo()}
        disabled={!map}
        title="Remove the last point placed"
      >
        <Undo2 size={15} aria-hidden />
        Undo point
      </button>
      <button
        type="button"
        className="btn-ghost"
        onClick={() => {
          map?.__drawer?.clear();
          onChange?.(null);
        }}
        disabled={!value}
      >
        <Trash2 size={15} aria-hidden />
        Clear
      </button>

      <span className="ml-auto flex items-baseline gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
        <span className="label">Area</span>
        <span className="tabular text-sm font-semibold text-tide-300">{ha.toFixed(2)}</span>
        <span className="text-xs text-slate-400">ha</span>
      </span>

      {hint && <p className="w-full text-xs leading-relaxed text-slate-400">{hint}</p>}
    </div>
  );
}
