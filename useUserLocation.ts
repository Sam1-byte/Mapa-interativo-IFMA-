import { useState, useEffect, useRef, useCallback } from "react"
import type { UserLocation, LocationStatus } from "../types/location"

export interface UseUserLocationReturn {
  location: UserLocation | null
  status: LocationStatus
  errorMessage: string | null
  // Call this when the user taps the location button
  requestLocation: () => void
}

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 5000,
}

function friendlyError(err: GeolocationPositionError): string {
  switch (err.code) {
    case 1: // PERMISSION_DENIED
      return "Acesso à localização negado. Verifique as permissões do navegador."
    case 2: // POSITION_UNAVAILABLE
      return "Localização temporariamente indisponível. Tente novamente."
    case 3: // TIMEOUT
      return "Tempo esgotado ao obter localização. Tente novamente."
    default:
      return "Não foi possível acessar sua localização."
  }
}

export function useUserLocation(): UseUserLocationReturn {
  const [location, setLocation] = useState<UserLocation | null>(null)
  const [status, setStatus] = useState<LocationStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("unavailable")
      setErrorMessage("Seu navegador não suporta geolocalização.")
      return
    }

    setStatus("requesting")
    setErrorMessage(null)

    // Clear any previous watch before starting a new one
    stopWatching()

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        })
        setStatus("available")
        setErrorMessage(null)
      },
      (err) => {
        setStatus(err.code === 1 ? "denied" : err.code === 2 ? "unavailable" : "error")
        setErrorMessage(friendlyError(err))
        // Keep the last known location visible even on transient errors
      },
      GEO_OPTIONS,
    )
  }, [stopWatching])

  const requestLocation = useCallback(() => {
    startWatching()
  }, [startWatching])

  // Stop watching on unmount to release GPS resources
  useEffect(() => {
    return () => {
      stopWatching()
    }
  }, [stopWatching])

  return { location, status, errorMessage, requestLocation }
}
