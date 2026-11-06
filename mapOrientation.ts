// Angle, in degrees CLOCKWISE, from the top edge of the campus image to geographic north.
//   0   -> north is at the top of the image
//   90  -> north is at the right of the image
//   180 -> north is at the bottom
//   270 -> north is at the left
//
// The campus image is an illustration with no north arrow or georeference, so the real
// angle is unknown. It MUST be measured (satellite view of the campus or an on-site check)
// and set here by hand. While this is null the automatic rotation stays disabled and the
// compass shows that north is not calibrated.
export const MAP_NORTH_OFFSET_DEG: number | null = null
