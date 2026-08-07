import * as turf from '@turf/turf';

/** Area of a GeoJSON polygon in hectares. */
export function hectares(geojson) {
  return turf.area(geojson) / 10000;
}

function labelFor(index) {
  const row = String.fromCharCode(65 + Math.floor(index / 6)); // A, B, C...
  return `${row}${(index % 6) + 1}`;
}

const OVERSAMPLE = 4;    // start with ~4 grid cells per member, then merge down
const MAX_CELLS = 700;   // keeps the clip + merge work bounded on large boundaries

/**
 * Split an approved boundary polygon into `count` roughly equal parcels.
 *
 * A square grid is laid over the boundary at roughly `1/OVERSAMPLE` of the target
 * parcel area and clipped to it. The resulting cells are then repeatedly merged —
 * always the smallest cell into its nearest neighbour — until exactly `count`
 * parcels remain. Merging smallest-first is what keeps the parcels comparable in
 * size, and clipping (rather than dropping) edge cells keeps 100% of the area.
 */
export function splitIntoChunks(polygon, count) {
  if (count < 1) throw new Error('At least one parcel is required');

  const feature = turf.feature(polygon);
  const totalArea = turf.area(feature);
  if (!totalArea) throw new Error('The selected area is empty');
  if (count === 1) return [describe(feature, 0)];

  const bbox = turf.bbox(feature);
  let cells = [];

  for (let attempt = 0; attempt < 4 && cells.length < count; attempt += 1) {
    const divisor = Math.min(count * OVERSAMPLE * 2 ** attempt, MAX_CELLS);
    const cellSideKm = Math.sqrt(totalArea / divisor) / 1000;
    cells = clipGrid(feature, bbox, cellSideKm);
  }
  if (!cells.length) return [describe(feature, 0)];

  // North -> south, then west -> east, so parcel labels read like a map.
  cells.sort((a, b) => {
    const ca = turf.centroid(a).geometry.coordinates;
    const cb = turf.centroid(b).geometry.coordinates;
    if (Math.abs(cb[1] - ca[1]) > 1e-7) return cb[1] - ca[1];
    return ca[0] - cb[0];
  });

  const parcels = cells.map((f) => ({ feature: f, area: turf.area(f), centre: turf.centroid(f) }));

  while (parcels.length > count) {
    let smallest = 0;
    for (let i = 1; i < parcels.length; i += 1) {
      if (parcels[i].area < parcels[smallest].area) smallest = i;
    }

    let neighbour = -1;
    let bestDist = Infinity;
    for (let i = 0; i < parcels.length; i += 1) {
      if (i === smallest) continue;
      const d = turf.distance(parcels[smallest].centre, parcels[i].centre, { units: 'kilometers' });
      if (d < bestDist) { bestDist = d; neighbour = i; }
    }

    const merged = safeUnion(parcels[neighbour].feature, parcels[smallest].feature);
    parcels[neighbour] = { feature: merged, area: turf.area(merged), centre: turf.centroid(merged) };
    parcels.splice(smallest, 1);
  }

  return parcels.map((p, i) => describe(p.feature, i));
}

function describe(feature, index) {
  const centroid = turf.centroid(feature).geometry.coordinates;
  return {
    label: labelFor(index),
    geometry: feature.geometry,
    centroid_lng: centroid[0],
    centroid_lat: centroid[1],
    area_hectares: Number((turf.area(feature) / 10000).toFixed(4)),
  };
}

function clipGrid(feature, bbox, cellSizeKm) {
  if (!(cellSizeKm > 0)) return [];

  // squareGrid drops cells that would overflow the bbox, so pad it by one cell
  // to guarantee the whole polygon gets tiled.
  const latPad = cellSizeKm / 110.574;
  const lngPad = cellSizeKm / (111.32 * Math.cos((bbox[1] * Math.PI) / 180) || 1);
  const padded = [bbox[0] - lngPad, bbox[1] - latPad, bbox[2] + lngPad, bbox[3] + latPad];

  let grid;
  try {
    grid = turf.squareGrid(padded, cellSizeKm, { units: 'kilometers' });
  } catch {
    return [];
  }
  if (grid.features.length > MAX_CELLS * 4) return [];

  const clipped = [];
  for (const cell of grid.features) {
    let piece;
    try {
      piece = turf.intersect(turf.featureCollection([cell, feature]));
    } catch {
      piece = null;
    }
    if (piece && turf.area(piece) > 1) clipped.push(piece);
  }
  return clipped;
}

function safeUnion(a, b) {
  try {
    // union() may return a MultiPolygon when cells only touch at a corner — that
    // is still valid GeoJSON and Leaflet renders it, so keep it whole.
    return turf.union(turf.featureCollection([a, b])) || a;
  } catch {
    return a;
  }
}

/** Rough tCO2e sequestered so far, damped by how reliably the community reported. */
export function carbonEstimate({ areaHectares, rate, startDate, participation = 1 }) {
  const start = new Date(startDate);
  const elapsedYears = Math.max(0, (Date.now() - start.getTime()) / (365.25 * 24 * 3600 * 1000));
  const gross = areaHectares * rate * elapsedYears;
  return {
    elapsedYears: Number(elapsedYears.toFixed(3)),
    grossTonnes: Number(gross.toFixed(3)),
    verifiedTonnes: Number((gross * participation).toFixed(3)),
  };
}

export const SEQUESTRATION_RATES = {
  mangrove: 6.5,
  seagrass: 3.9,
  saltmarsh: 5.2,
};
