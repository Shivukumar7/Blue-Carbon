const EARTH_RADIUS_M = 6378137;
const rad = (deg) => (deg * Math.PI) / 180;

/**
 * Geodesic area of a GeoJSON ring in square metres (spherical excess).
 * Same formula Leaflet.GeometryUtil and turf use, inlined so the client does not
 * have to ship a full geometry library just to show "12.4 ha".
 */
function ringArea(coords) {
  if (coords.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < coords.length; i += 1) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[(i + 1) % coords.length];
    total += rad(lng2 - lng1) * (2 + Math.sin(rad(lat1)) + Math.sin(rad(lat2)));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

export function areaHectares(geometry) {
  if (!geometry) return 0;
  const polygons =
    geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];

  const sqm = polygons.reduce((sum, rings) => {
    if (!rings?.length) return sum;
    const outer = ringArea(rings[0]);
    const holes = rings.slice(1).reduce((h, r) => h + ringArea(r), 0);
    return sum + Math.max(0, outer - holes);
  }, 0);

  return sqm / 10000;
}

/** Rough centroid ([lat, lng]) of a polygon, good enough for map centring. */
export function centroidOf(geometry) {
  if (!geometry) return null;
  const rings =
    geometry.type === 'MultiPolygon' ? geometry.coordinates.map((p) => p[0]) : [geometry.coordinates[0]];

  let lat = 0;
  let lng = 0;
  let n = 0;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      lng += x;
      lat += y;
      n += 1;
    }
  }
  return n ? [lat / n, lng / n] : null;
}

/** Estimated tonnes of CO2e for an area over a period — mirrors the server model. */
export function carbonProjection(areaHa, ratePerHaYear, years) {
  return Number((areaHa * ratePerHaYear * years).toFixed(2));
}
