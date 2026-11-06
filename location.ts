export interface UserLocation {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

export type LocationStatus =
  | "idle"        // not yet requested
  | "requesting"  // acquiring GPS / awaiting permission
  | "available"   // position obtained
  | "denied"      // user denied permission
  | "unavailable" // GPS not available on device
  | "error"       // timeout or other transient error

// Placeholder for ETAPA 2 (compass / DeviceOrientation)
export interface DeviceHeading {
  heading: number | null  // 0–360° true north
  alpha: number | null
  beta: number | null
  gamma: number | null
}

export type CampusLocationType =
  | "building"
  | "dining"
  | "sport"
  | "leisure"
  | "parking"
  | "access"

export interface LocationService {
  name: string
  description?: string
}

/** "illustrative" = placeholder content that must be replaced with confirmed IFMA data. */
export type DataStatus = "illustrative" | "confirmed"

export interface CampusLocation {
  id: string
  name: string
  type: CampusLocationType
  /** SVG polygon points in the 1227×1282 map image space */
  points: string
  description: string | null
  /** Building or area where the space is located; null = not yet registered */
  building: string | null
  services: LocationService[]
  tips: string[]
  dataStatus: DataStatus
}
