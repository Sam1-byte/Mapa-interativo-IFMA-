import { useCallback, useEffect, useRef, useState } from "react"

export type OrientationStatus =
  | "idle"
  | "requesting"
  | "active"
  | "denied"
  | "unsupported"
  | "insecure"
  | "unavailable"

type CompassEvent = DeviceOrientationEvent & { webkitCompassHeading?: number }
type PermissionApi = { requestPermission?: () => Promise<"granted" | "denied"> }

const FIRST_READING_TIMEOUT_MS = 4000
const SIGNAL_LOST_MS = 5000
const SMOOTHING = 0.3
const DEADBAND_DEG = 1.5

const norm = (d: number) => ((d % 360) + 360) % 360
const wrap180 = (d: number) => norm(d + 180) - 180

function screenAngle() {
  return window.screen.orientation?.angle ?? 0
}

/**
 * Device compass heading (degrees clockwise from true/magnetic north).
 * Independent from GPS: it never reads or simulates a position, and never
 * produces a value when the sensor does not report an absolute heading.
 */
export function useDeviceOrientation() {
  const [status, setStatus] = useState<OrientationStatus>("idle")
  const [heading, setHeading] = useState<number | null>(null)
  const teardown = useRef<(() => void) | null>(null)

  const disable = useCallback(() => {
    teardown.current?.()
    teardown.current = null
    setStatus("idle")
    setHeading(null)
  }, [])

  const enable = useCallback(async () => {
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      setStatus("unsupported")
      return
    }
    if (!window.isSecureContext) {
      setStatus("insecure")
      return
    }
    teardown.current?.()
    teardown.current = null
    setStatus("requesting")

    // iOS 13+: must be called directly from a user gesture
    const api = DeviceOrientationEvent as unknown as PermissionApi
    if (typeof api.requestPermission === "function") {
      try {
        if ((await api.requestPermission()) !== "granted") {
          setStatus("denied")
          return
        }
      } catch {
        setStatus("denied")
        return
      }
    }

    let smoothed: number | null = null
    let published: number | null = null
    let lastEvent = 0
    let gotReading = false
    const startedAt = Date.now()

    const onEvent = (e: Event) => {
      const ev = e as CompassEvent
      let raw: number | null = null
      if (typeof ev.webkitCompassHeading === "number" && !Number.isNaN(ev.webkitCompassHeading)) {
        raw = ev.webkitCompassHeading
      } else if (ev.alpha !== null && (e.type === "deviceorientationabsolute" || ev.absolute)) {
        raw = norm(360 - ev.alpha)
      }
      if (raw === null) return

      const h = norm(raw + screenAngle())
      smoothed = smoothed === null ? h : norm(smoothed + wrap180(h - smoothed) * SMOOTHING)
      lastEvent = Date.now()
      if (!gotReading) {
        gotReading = true
        setStatus("active")
      }
      if (published === null || Math.abs(wrap180(smoothed - published)) >= DEADBAND_DEG) {
        published = smoothed
        setHeading(smoothed)
      }
    }

    // Prefer the absolute (north-referenced) event; the relative one is only
    // accepted by onEvent when it flags itself as absolute or provides webkitCompassHeading.
    window.addEventListener("deviceorientationabsolute", onEvent as EventListener)
    window.addEventListener("deviceorientation", onEvent as EventListener)

    const watchdog = window.setInterval(() => {
      const stalled = gotReading
        ? Date.now() - lastEvent > SIGNAL_LOST_MS
        : Date.now() - startedAt > FIRST_READING_TIMEOUT_MS
      if (stalled) {
        teardown.current?.()
        teardown.current = null
        setHeading(null)
        setStatus("unavailable")
      }
    }, 1000)

    teardown.current = () => {
      window.removeEventListener("deviceorientationabsolute", onEvent as EventListener)
      window.removeEventListener("deviceorientation", onEvent as EventListener)
      window.clearInterval(watchdog)
    }
  }, [])

  useEffect(() => () => teardown.current?.(), [])

  return { status, heading, enable, disable }
}
