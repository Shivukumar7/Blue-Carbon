import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export const PARCEL_COLORS = {
  reported: '#34D399',   // reading filed for the selected day
  pending: '#FBBF24',    // assigned, nothing filed yet
  unassigned: '#64748B', // no member holds this parcel
  mine: '#22D3EE',       // the signed-in member's own parcel
};

function styleFor(state, selected) {
  const color = PARCEL_COLORS[state] ?? PARCEL_COLORS.unassigned;
  return {
    color,
    weight: selected ? 3.5 : 1.6,
    opacity: selected ? 1 : 0.85,
    fillColor: color,
    fillOpacity: selected ? 0.42 : 0.2,
    dashArray: state === 'pending' ? '4 4' : null,
  };
}

/**
 * Draws every parcel of a project. `parcels` is a list of
 * `{ id, label, geometry, state }` where state is a key of PARCEL_COLORS.
 */
export default function ParcelLayer({ parcels = [], selectedId, onSelect, showLabels = true }) {
  const map = useMap();
  const groupRef = useRef(null);

  useEffect(() => {
    const group = L.layerGroup().addTo(map);
    groupRef.current = group;
    return () => {
      map.removeLayer(group);
      groupRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.clearLayers();

    for (const parcel of parcels) {
      const selected = parcel.id === selectedId;
      const layer = L.geoJSON(parcel.geometry, { style: styleFor(parcel.state, selected) });

      layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.5, weight: 3 }));
      layer.on('mouseout', () => layer.setStyle(styleFor(parcel.state, selected)));
      if (onSelect) {
        layer.on('click', () => onSelect(parcel));
        layer.eachLayer((l) => {
          const el = l.getElement?.();
          if (el) el.style.cursor = 'pointer';
        });
      }

      if (parcel.tooltip) {
        layer.bindTooltip(parcel.tooltip, { sticky: true, direction: 'top', opacity: 0.95 });
      }
      group.addLayer(layer);

      if (showLabels && parcel.centroid) {
        group.addLayer(
          L.marker(parcel.centroid, {
            interactive: false,
            keyboard: false,
            icon: L.divIcon({
              className: 'parcel-label',
              html: `<span>${parcel.label}</span>`,
              iconSize: [30, 16],
              iconAnchor: [15, 8],
            }),
          })
        );
      }
    }
  }, [parcels, selectedId, onSelect, showLabels]);

  return null;
}

/** A soft outline of the whole project boundary, drawn beneath the parcels. */
export function BoundaryLayer({ geometry, color = '#22D3EE' }) {
  const map = useMap();
  useEffect(() => {
    if (!geometry) return undefined;
    const layer = L.geoJSON(geometry, {
      style: { color, weight: 2, opacity: 0.85, fill: false, dashArray: '6 6' },
      interactive: false,
    }).addTo(map);
    return () => map.removeLayer(layer);
  }, [map, geometry, color]);
  return null;
}
