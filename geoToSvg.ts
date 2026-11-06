// Coordinate mapping: GPS ↔ campus SVG space
//
// The campus SVG uses original coordinate space (before the 90° rotation applied by CampusMap).
// The SVG viewBox is "0 0 540 740" (mapH × mapW). Inside the rotated group,
// a point (origX, origY) is rendered at screen position (mapH − origY, origX).
//
// CALIBRATION INSTRUCTIONS:
// These bounds are approximate placeholders for IFMA São João dos Patos.
// To calibrate precisely: identify two physical GPS waypoints on campus, read
// their GPS coordinates, note where they fall in SVG space, then solve for
// CAMPUS_BOUNDS so that geoToSvg maps them correctly.

const CAMPUS_BOUNDS = {
  // Approximate bounds — replace with surveyed values when available
  north: -6.524,
  south: -6.530,
  west:  -43.712,
  east:  -43.707,
}

// Original SVG extents of the campus ground area
const SVG_BOUNDS = {
  minX: 40,
  maxX: 700,
  minY: 80,
  maxY: 510,
}

// Campus center latitude for longitude-to-metres conversion
const LAT_REF_RAD = (-6.527 * Math.PI) / 180

// Approximate metres per SVG unit (longitude axis)
const LON_RANGE_DEG = CAMPUS_BOUNDS.east - CAMPUS_BOUNDS.west
const LON_RANGE_M = LON_RANGE_DEG * 111320 * Math.cos(LAT_REF_RAD)
const METRES_PER_SVG_UNIT = LON_RANGE_M / (SVG_BOUNDS.maxX - SVG_BOUNDS.minX)

export interface SvgPoint {
  x: number
  y: number
}

/** Convert GPS coordinates to original SVG space (pre-rotation). */
export function geoToSvg(lat: number, lon: number): SvgPoint {
  const { north, south, west, east } = CAMPUS_BOUNDS
  const { minX, maxX, minY, maxY } = SVG_BOUNDS

  const x = minX + ((lon - west) / (east - west)) * (maxX - minX)
  const y = minY + ((north - lat) / (north - south)) * (maxY - minY)

  return { x, y }
}

/** Convert GPS accuracy (metres) to an approximate SVG radius. */
export function accuracyToSvgRadius(accuracyMetres: number): number {
  return accuracyMetres / METRES_PER_SVG_UNIT
}

/** Return true if the coordinates are within (or very near) the campus. */
export function isWithinCampus(lat: number, lon: number): boolean {
  const { north, south, west, east } = CAMPUS_BOUNDS
  const margin = 0.003
  return (
    lat >= south - margin &&
    lat <= north + margin &&
    lon >= west - margin &&
    lon <= east + margin
  )
}

/**
 * Compute pan offsets (in SVG units) that centre a given original-space point
 * inside the viewport after applying the 90° rotation used by CampusMap.
 *
 * Transform chain:
 *   Original (origX, origY)
 *   → rotate(90) → (-origY, origX)
 *   → translate(mapH, 0) → (mapH − origY, origX)      ← rotatedX, rotatedY
 *   → translate(pan.x, pan.y) scale(zoom) → final screen position
 *
 * To centre at viewport centre (mapH/2, mapW/2):
 *   pan.x = mapH/2 − rotatedX × zoom
 *   pan.y = mapW/2 − rotatedY × zoom
 */
export function computePanToCenter(
  origX: number,
  origY: number,
  zoom: number,
  mapH = 540,
  mapW = 740,
): { x: number; y: number } {
  const rotatedX = mapH - origY
  const rotatedY = origX
  return {
    x: mapH / 2 - rotatedX * zoom,
    y: mapW / 2 - rotatedY * zoom,
  }
}
