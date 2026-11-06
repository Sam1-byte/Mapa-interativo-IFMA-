import { useState, useRef, useCallback, useEffect } from "react"
import { useUserLocation } from "./hooks/useUserLocation"
import { geoToSvg, isWithinCampus, computePanToCenter } from "./utils/geoToSvg"
import { LocationButton } from "./components/Map/LocationButton"
import campusMapImage from "./assets/mapa-real-campus-ifma.jpg"
import {
  CAMPUS_LOCATIONS,
  TYPE_COLORS,
  typeIcon,
  searchLocations,
  locationCenter,
} from "./data/campusLocations"
import type { CampusLocation } from "./types/location"
import { useDeviceOrientation, type OrientationStatus } from "./hooks/useDeviceOrientation"
import { useSmoothedAngle } from "./hooks/useSmoothedAngle"
import { MAP_NORTH_OFFSET_DEG } from "./config/mapOrientation"
import { MapCompass, OrientationButton, OrientationNotice, type OrientationNoticeData } from "./components/Map/MapCompass"
import { XIcon } from "./components/Map/icons"

const MAP_CENTER = { x: 613.5, y: 641 }

const ORIENTATION_ERRORS: Partial<Record<OrientationStatus, { title: string; text: string }>> = {
  denied: {
    title: "Permissão negada",
    text: "Sem acesso aos sensores de movimento o mapa continua fixo. Para usar a orientação, permita o acesso nas configurações do navegador e tente de novo.",
  },
  unsupported: {
    title: "Sensores não suportados",
    text: "Este navegador ou dispositivo não oferece a bússola. O mapa continua fixo e todas as outras funções seguem disponíveis.",
  },
  insecure: {
    title: "Conexão não segura",
    text: "Os navegadores só liberam a bússola em páginas HTTPS. O mapa continua fixo.",
  },
  unavailable: {
    title: "Direção indisponível",
    text: "O dispositivo não está informando a direção no momento (comum em computadores ou com a bússola descalibrada). O mapa voltou à orientação original.",
  },
}

const wrap180 = (d: number) => (((d + 180) % 360) + 360) % 360 - 180

// ---------------------------------------------------------------------------
// CampusMap
// ---------------------------------------------------------------------------

interface CampusMapProps {
  zoom: number
  pan: { x: number; y: number }
  onPanChange: (pan: { x: number; y: number }) => void
  selectedArea: CampusLocation | null
  destination: CampusLocation | null
  rotation: number
  onSelectArea: (area: CampusLocation) => void
}

function CampusMap({
  zoom,
  pan,
  onPanChange,
  selectedArea,
  destination,
  rotation,
  onSelectArea,
}: CampusMapProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  const hasDragged = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, clientX: 0, clientY: 0 })
  const panStart = useRef({ x: 0, y: 0 })
  const rotationRef = useRef(rotation)
  rotationRef.current = rotation

  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    const matrix = svg?.getScreenCTM()
    if (!svg || !matrix) return { x: clientX, y: clientY }

    const point = svg.createSVGPoint()
    point.x = clientX
    point.y = clientY
    return point.matrixTransform(matrix.inverse())
  }, [])

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    dragging.current = true
    hasDragged.current = false
    const point = clientToSvg(e.clientX, e.clientY)
    dragStart.current = {
      x: point.x,
      y: point.y,
      clientX: e.clientX,
      clientY: e.clientY,
    }
    panStart.current = { ...pan }
  }

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!dragging.current) return
      const point = clientToSvg(e.clientX, e.clientY)
      if (
        Math.hypot(
          e.clientX - dragStart.current.clientX,
          e.clientY - dragStart.current.clientY,
        ) > 4
      ) {
        if (!hasDragged.current) e.currentTarget.setPointerCapture(e.pointerId)
        hasDragged.current = true
      }
      if (!hasDragged.current) return
      // Pan lives in the rotated frame, so un-rotate the screen-space drag delta
      const dx = point.x - dragStart.current.x
      const dy = point.y - dragStart.current.y
      const r = (rotationRef.current * Math.PI) / 180
      onPanChange({
        x: panStart.current.x + dx * Math.cos(r) + dy * Math.sin(r),
        y: panStart.current.y - dx * Math.sin(r) + dy * Math.cos(r),
      })
    },
    [clientToSvg, onPanChange],
  )

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    dragging.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const handleAreaClick = (
    e: React.MouseEvent<SVGPolygonElement>,
    area: CampusLocation,
  ) => {
    e.stopPropagation()
    if (hasDragged.current) {
      hasDragged.current = false
      return
    }
    onSelectArea(area)
  }

  const handleAreaKeyDown = (
    e: React.KeyboardEvent<SVGPolygonElement>,
    area: CampusLocation,
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onSelectArea(area)
    }
  }

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1227 1282"
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full cursor-grab active:cursor-grabbing select-none"
      style={{ touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={() => {
        hasDragged.current = false
      }}
      role="group"
      aria-label="Mapa real do Campus São João dos Patos do IFMA"
    >
      <g
        transform={`translate(${MAP_CENTER.x} ${MAP_CENTER.y}) rotate(${rotation}) translate(${pan.x} ${pan.y}) scale(${zoom}) translate(${-MAP_CENTER.x} ${-MAP_CENTER.y})`}
      >
        <image
          href={campusMapImage}
          width="1227"
          height="1282"
          preserveAspectRatio="xMidYMid meet"
        />
        {CAMPUS_LOCATIONS.map((area) => {
          const isSelected = selectedArea?.id === area.id
          const isDestination = destination?.id === area.id
          return (
            <polygon
              key={area.id}
              points={area.points}
              role="button"
              tabIndex={0}
              aria-label={`Abrir informações de ${area.name}`}
              className={[
                "cursor-pointer transition-colors duration-150 outline-none",
                isDestination
                  ? "fill-red-600/25 stroke-red-600"
                  : isSelected
                  ? "fill-ifma-green/25 stroke-white"
                  : "fill-transparent stroke-transparent hover:fill-ifma-green/15 hover:stroke-white focus:fill-ifma-green/20 focus:stroke-white",
              ].join(" ")}
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
              onClick={(e) => handleAreaClick(e, area)}
              onKeyDown={(e) => handleAreaKeyDown(e, area)}
            >
              <title>{area.name}</title>
            </polygon>
          )
        })}
        {destination && (() => {
          const c = locationCenter(destination)
          return (
            <g transform={`translate(${c.x} ${c.y}) scale(${1 / zoom}) rotate(${-rotation})`} pointerEvents="none">
              <circle r="14" fill="#dc2626" opacity="0.3">
                <animate attributeName="r" values="14;30;14" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.35;0;0.35" dur="2s" repeatCount="indefinite" />
              </circle>
              <path
                d="M0 0 C-10 -14 -14 -20 -14 -28 a14 14 0 1 1 28 0 C14 -20 10 -14 0 0 Z"
                fill="#dc2626"
                stroke="#fff"
                strokeWidth="2.5"
              />
              <circle cy="-28" r="5" fill="#fff" />
            </g>
          )
        })()}
      </g>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// LocationPanel
// ---------------------------------------------------------------------------

function LocationPanel({
  location,
  isDestination,
  onClose,
  onDirections,
}: {
  location: CampusLocation
  isDestination: boolean
  onClose: () => void
  onDirections: () => void
}) {
  const illustrative = location.dataStatus === "illustrative"
  return (
    <div
      className="absolute left-3 md:left-6 bottom-3 md:bottom-6 z-20 flex w-[calc(100%-4.5rem)] max-w-sm max-h-[55%] md:max-h-[calc(100%-3rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      role="dialog"
      aria-modal="false"
      aria-labelledby="map-area-title"
    >
      <div className="flex items-start gap-3 border-b border-slate-100 p-4">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#1a6b3c]">
            {typeIcon(location.type)} {TYPE_COLORS[location.type].label}
          </p>
          <h2 id="map-area-title" className="text-base font-bold leading-snug text-slate-800" style={{ fontFamily: "'Outfit', sans-serif" }}>
            {location.name}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a6b3c]/30"
          aria-label="Fechar informações do local"
          title="Fechar (Esc)"
        >
          <XIcon />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {illustrative && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            <strong>Informações ilustrativas.</strong> Ainda não confirmadas pelo IFMA.
          </p>
        )}

        <p className="text-sm leading-relaxed text-slate-600">
          {location.description ?? "Descrição ainda não cadastrada."}
        </p>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-400">Prédio / área</p>
          <p className={location.building ? "text-sm text-slate-700" : "text-sm italic text-slate-400"}>
            {location.building ?? "Ainda não cadastrado"}
          </p>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">Setores e serviços</p>
          {location.services.length > 0 ? (
            <ul className="space-y-1.5">
              {location.services.map((service) => (
                <li key={service.name} className="flex gap-2 text-sm text-slate-700">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1a6b3c]" aria-hidden="true" />
                  <span>
                    {service.name}
                    {service.description && <span className="block text-xs text-slate-500">{service.description}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm italic text-slate-400">Nenhum serviço cadastrado.</p>
          )}
        </div>

        {location.tips.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">Orientações ao visitante</p>
            <ul className="space-y-1.5">
              {location.tips.map((tip) => (
                <li key={tip} className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 p-3">
        <button
          onClick={onDirections}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#1a6b3c] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#155a32] focus:outline-none focus:ring-2 focus:ring-[#1a6b3c]/40 focus:ring-offset-2"
        >
          {isDestination ? "Destino definido · centralizar" : "Como chegar?"}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  const [activeTab, setActiveTab] = useState<"mapa" | "acesso" | "sobre">("mapa")
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<CampusLocation | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [showLegend, setShowLegend] = useState(false)
  const [selectedMapArea, setSelectedMapArea] = useState<CampusLocation | null>(null)
  const [destination, setDestination] = useState<CampusLocation | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const orientation = useDeviceOrientation()
  const [orientationMode, setOrientationMode] = useState(false)
  const [orientationNotice, setOrientationNotice] = useState<OrientationNoticeData | null>(null)
  const northConfigured = MAP_NORTH_OFFSET_DEG !== null
  // Image-north offset is only applied when it was configured by hand
  const targetRotation =
    orientationMode && northConfigured && orientation.heading !== null
      ? -orientation.heading - (MAP_NORTH_OFFSET_DEG ?? 0)
      : 0
  const rotation = useSmoothedAngle(targetRotation)
  const isRotated = Math.abs(wrap180(rotation)) > 0.5
  const northAngle = northConfigured ? (MAP_NORTH_OFFSET_DEG ?? 0) + rotation : null

  const disableOrientation = useCallback(() => {
    orientation.disable()
    setOrientationMode(false)
    setOrientationNotice(null)
  }, [orientation.disable])

  const handleOrientationToggle = () => {
    if (!northConfigured) {
      setOrientationNotice({
        kind: "info",
        title: "Rotação automática indisponível",
        text: "A imagem do campus ainda não tem o ângulo do norte configurado, então o mapa permanece fixo. Defina MAP_NORTH_OFFSET_DEG em src/config/mapOrientation.ts para habilitar.",
      })
    } else if (orientationMode) {
      disableOrientation()
    } else {
      setOrientationNotice({
        kind: "explain",
        title: "Girar o mapa com o celular?",
        text: "O mapa vai girar conforme a direção para a qual você aponta o aparelho. Para isso o navegador pode pedir acesso aos sensores de movimento. Nada é enviado nem gravado, e isso não usa o GPS.",
      })
    }
  }

  const confirmOrientation = () => {
    setOrientationNotice(null)
    setOrientationMode(true)
    void orientation.enable()
  }

  useEffect(() => {
    const err = ORIENTATION_ERRORS[orientation.status]
    if (err) {
      setOrientationMode(false)
      setOrientationNotice({ kind: "error", ...err })
    }
  }, [orientation.status])

  useEffect(() => {
    if (activeTab !== "mapa") disableOrientation()
  }, [activeTab, disableOrientation])

  const { location: userLocation, status: locationStatus, errorMessage, requestLocation } = useUserLocation()

  // Dismiss error toast after 5 s
  const [showErrorToast, setShowErrorToast] = useState(false)
  useEffect(() => {
    if (errorMessage) {
      setShowErrorToast(true)
      const t = setTimeout(() => setShowErrorToast(false), 5000)
      return () => clearTimeout(t)
    }
  }, [errorMessage])

  const handleCenterOnUser = useCallback(() => {
    requestLocation()
    if (userLocation && isWithinCampus(userLocation.latitude, userLocation.longitude)) {
      const svgPos = geoToSvg(userLocation.latitude, userLocation.longitude)
      const targetZoom = Math.max(zoom, 1.4)
      setZoom(targetZoom)
      setPan(computePanToCenter(svgPos.x, svgPos.y, targetZoom))
    }
  }, [requestLocation, userLocation, zoom])

  // Auto-center map the first time a location becomes available
  const hasCenteredRef = useRef(false)
  useEffect(() => {
    if (locationStatus === "available" && userLocation && !hasCenteredRef.current) {
      hasCenteredRef.current = true
      if (isWithinCampus(userLocation.latitude, userLocation.longitude)) {
        const svgPos = geoToSvg(userLocation.latitude, userLocation.longitude)
        const targetZoom = 1.4
        setZoom(targetZoom)
        setPan(computePanToCenter(svgPos.x, svgPos.y, targetZoom))
      }
    }
  }, [locationStatus, userLocation])

  const filtered = searchLocations(query)

  const focusLocation = useCallback((loc: CampusLocation, targetZoom = 1.6) => {
    const c = locationCenter(loc)
    // Keep the target above the bottom sheet on narrow screens
    const yShift = window.innerWidth < 768 ? 200 : 0
    setZoom(targetZoom)
    const r = (rotation * Math.PI) / 180
    setPan({
      x: -targetZoom * (c.x - MAP_CENTER.x) - yShift * Math.sin(r),
      y: -targetZoom * (c.y - MAP_CENTER.y) - yShift * Math.cos(r),
    })
  }, [rotation])

  const handleSelect = (loc: CampusLocation) => {
    setSelected(loc)
    setQuery(loc.name)
    setSelectedMapArea(loc)
    focusLocation(loc, Math.max(zoom, 1.4))
  }

  const handleDirections = (loc: CampusLocation) => {
    setDestination(loc)
    focusLocation(loc)
  }

  const closePanel = useCallback(() => setSelectedMapArea(null), [])

  useEffect(() => {
    if (!selectedMapArea) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selectedMapArea, closePanel])

  const handleClear = () => {
    setQuery("")
    setSelected(null)
    inputRef.current?.focus()
  }

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 2.5))
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.4))
  const handleReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const showResults = query.trim().length > 0 && !selected
  const noResults = showResults && filtered.length === 0

  const locationLabel = (() => {
    if (locationStatus === "requesting") return "Obtendo localização…"
    if (locationStatus === "available" && userLocation) {
      return isWithinCampus(userLocation.latitude, userLocation.longitude)
        ? "Dentro do campus"
        : "Fora do campus"
    }
    if (locationStatus === "denied") return "Permissão negada"
    if (locationStatus === "unavailable") return "GPS indisponível"
    if (locationStatus === "error") return "Erro ao obter localização"
    return "Toque em 'Minha Localização' no mapa"
  })()

  return (
    <div className="flex flex-col h-full bg-slate-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3 bg-white border-b border-slate-200 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center justify-center shrink-0 w-10 h-10 rounded-md bg-[#1a6b3c]">
            <span className="text-white text-sm font-bold leading-none" style={{ fontFamily: "'Outfit', sans-serif" }}>IF</span>
            <span className="text-white text-[9px] font-bold leading-none tracking-widest" style={{ fontFamily: "'Outfit', sans-serif" }}>MA</span>
          </div>
          <div className="min-w-0 border-l border-slate-200 pl-3">
            <div style={{ fontFamily: "'Outfit', sans-serif" }} className="text-sm text-slate-800 leading-none tracking-tight font-bold truncate">
              Mapa do Campus
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs text-slate-400 bg-slate-100 rounded px-2 py-1">MVP v1.0</span>
        </div>
      </header>

      {/* Tab bar */}
      <div className="flex items-end gap-0 px-5 bg-white border-b border-slate-200 shrink-0">
        {(
          [
            { id: "mapa", label: "Mapa do Campus", icon: "🗺️" },
            { id: "acesso", label: "Acesso Rápido", icon: "⚡" },
            { id: "sobre", label: "Sobre", icon: "ℹ️" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.id
                ? "border-[#1a6b3c] text-[#1a6b3c]"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
            ].join(" ")}
          >
            <span className="text-base leading-none">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Acesso Rápido tab */}
      {activeTab === "acesso" && (
        <div className="flex-1 overflow-y-auto bg-slate-50">
          <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">

            {/* Search */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Buscar local</p>
              </div>
              <div className="px-5 py-4">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <SearchIcon />
                  </span>
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setSelected(null) }}
                    placeholder="Nome, serviço ou tipo de espaço…"
                    className="w-full pl-9 pr-8 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a6b3c]/30 focus:border-[#1a6b3c] transition-all"
                  />
                  {query && (
                    <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <XIcon />
                    </button>
                  )}
                </div>
                {showResults && filtered.length > 0 && (
                  <div className="mt-3 space-y-0.5">
                    <p className="text-xs text-slate-400 px-1 pb-1">
                      {filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}
                    </p>
                    {filtered.map((loc) => (
                      <button
                        key={loc.id}
                        onClick={() => { handleSelect(loc); setActiveTab("mapa") }}
                        className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-3 group"
                      >
                        <span className="text-base shrink-0">{typeIcon(loc.type)}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate group-hover:text-slate-900">{loc.name}</p>
                          <p className="text-xs text-slate-400">{loc.building ?? "Prédio/área a cadastrar"}</p>
                        </div>
                        <svg className="w-3 h-3 text-slate-300 shrink-0 ml-auto group-hover:text-[#1a6b3c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    ))}
                  </div>
                )}
                {noResults && (
                  <div className="mt-4 text-center py-4">
                    <div className="text-2xl mb-2">🔍</div>
                    <p className="text-sm font-medium text-slate-600">Nenhum local encontrado</p>
                    <p className="text-xs text-slate-400 mt-1">Tente outro nome, serviço ou tipo</p>
                  </div>
                )}
              </div>
            </div>

            {/* User location card */}
            <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex items-center gap-4">
              <div className="relative shrink-0">
                <div className={[
                  "w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                  locationStatus === "available" ? "bg-blue-50" : "bg-slate-100",
                ].join(" ")}>
                  {locationStatus === "requesting" ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" className="animate-spin">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  ) : (
                    <div className={[
                      "w-3 h-3 rounded-full ring-2",
                      locationStatus === "available" ? "bg-blue-500 ring-blue-200" : "bg-slate-300 ring-slate-100",
                    ].join(" ")} />
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">Sua localização atual</p>
                <p className="text-xs text-slate-400 mt-0.5 truncate">{locationLabel}</p>
              </div>
              {(locationStatus === "idle" || locationStatus === "denied" || locationStatus === "error") && (
                <button
                  onClick={() => { requestLocation(); setActiveTab("mapa") }}
                  className="text-xs font-medium text-[#1a6b3c] hover:underline shrink-0"
                >
                  Ativar
                </button>
              )}
            </div>

            {/* Quick shortcuts */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest px-1 pb-3">Atalhos principais</p>
              <div className="space-y-2">
                {CAMPUS_LOCATIONS.map((loc) => {
                  const id = loc.id
                  return (
                    <button
                      key={id}
                      onClick={() => { handleSelect(loc); setActiveTab("mapa") }}
                      className="w-full text-left bg-white border border-slate-200 rounded-2xl px-5 py-4 hover:border-[#1a6b3c]/40 hover:shadow-sm transition-all flex items-center gap-4 group"
                    >
                      <span className="text-2xl shrink-0">{typeIcon(loc.type)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 truncate">{loc.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{loc.building ?? "Prédio/área a cadastrar"}</p>
                      </div>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0 group-hover:bg-[#1a6b3c]/10 group-hover:text-[#1a6b3c] transition-colors">
                        {TYPE_COLORS[loc.type].label}
                      </span>
                      <svg className="w-4 h-4 text-slate-300 shrink-0 group-hover:text-[#1a6b3c] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  )
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Sobre tab */}
      {activeTab === "sobre" && (
        <div className="flex-1 overflow-y-auto bg-slate-50">
          <div className="max-w-2xl mx-auto px-5 py-8 space-y-6">

            <div className="bg-[#1a6b3c] rounded-2xl px-6 py-7 flex items-center gap-5">
              <div className="flex flex-col items-center justify-center w-16 h-16 rounded-xl bg-white/15 shrink-0">
                <span className="text-white text-xl font-bold leading-none" style={{ fontFamily: "'Outfit', sans-serif" }}>IF</span>
                <span className="text-white text-[11px] font-bold leading-none tracking-widest" style={{ fontFamily: "'Outfit', sans-serif" }}>MA</span>
              </div>
              <div>
                <h1 className="text-white text-lg font-bold leading-snug" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  Mapa Virtual do Campus
                </h1>
                <p className="text-green-200 text-xs mt-1">Instituto Federal do Maranhão</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 px-6 py-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Sobre o projeto</p>
              <p className="text-sm text-slate-600 leading-relaxed">
                Ferramenta de navegação interna desenvolvida para facilitar o acesso a salas, laboratórios, serviços e demais espaços do campus — pensada para alunos, servidores e visitantes.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Legenda dos espaços</p>
              </div>
              <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                {Object.entries(TYPE_COLORS).map(([type, cfg]) => (
                  <div key={type} className="flex items-center gap-2.5">
                    <div className="w-4 h-3.5 rounded-sm border shrink-0" style={{ background: cfg.fill, borderColor: cfg.stroke }} />
                    <span className="text-xs text-slate-600">{cfg.label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-3.5 rounded-sm border-2 shrink-0" style={{ background: "#dc2626", borderColor: "#991b1b" }} />
                  <span className="text-xs text-slate-600">Selecionado</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-3.5 rounded-full shrink-0 border-2 border-white shadow-sm" style={{ background: "#2563eb" }} />
                  <span className="text-xs text-slate-600">Você está aqui</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <p className="text-xs text-slate-400">MVP v1.0 — Protótipo inicial</p>
              <p className="text-xs text-slate-400">{CAMPUS_LOCATIONS.length} espaços mapeados</p>
            </div>

          </div>
        </div>
      )}

      {/* Mapa tab */}
      {activeTab === "mapa" && (
        <main className="flex-1 relative overflow-hidden bg-slate-100">
          {/* Dot grid background */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, #d1d5db 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          />

          {/* Map canvas */}
          <div className="absolute inset-0 flex items-center justify-center p-3 md:p-6">
            <div className="w-full h-full rounded-2xl overflow-hidden shadow-xl border border-slate-200/60 bg-white/90 backdrop-blur-sm">
              <CampusMap
                zoom={zoom}
                pan={pan}
                onPanChange={setPan}
                selectedArea={selectedMapArea}
                destination={destination}
                rotation={rotation}
                onSelectArea={setSelectedMapArea}
              />
            </div>
          </div>

          {/* Compass */}
          <MapCompass northAngle={northAngle} isRotated={isRotated} onReset={disableOrientation} />
          {orientationNotice && (
            <OrientationNotice
              notice={orientationNotice}
              onConfirm={confirmOrientation}
              onClose={() => setOrientationNotice(null)}
            />
          )}

          {/* Map controls */}
          <div className="absolute right-3 md:right-6 bottom-3 md:bottom-6 flex flex-col gap-1.5 z-10">
            {/* Location button */}
            <LocationButton status={locationStatus} onClick={handleCenterOnUser} />

            <OrientationButton
              active={orientationMode && orientation.status === "active"}
              requesting={orientation.status === "requesting"}
              available={northConfigured}
              onClick={handleOrientationToggle}
            />

            {/* Zoom controls */}
            <button
              onClick={handleZoomIn}
              className="w-9 h-9 bg-white rounded-lg border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors font-semibold text-base"
              title="Ampliar"
            >
              +
            </button>
            <button
              onClick={handleZoomOut}
              className="w-9 h-9 bg-white rounded-lg border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors font-semibold text-base"
              title="Reduzir"
            >
              −
            </button>
            <button
              onClick={handleReset}
              className="w-9 h-9 bg-white rounded-lg border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors text-sm"
              title="Centralizar mapa"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="3" />
                <line x1="12" y1="2" x2="12" y2="5" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="2" y1="12" x2="5" y2="12" />
                <line x1="19" y1="12" x2="22" y2="12" />
              </svg>
            </button>
          </div>

          {/* Selected destination toast */}
          {destination && (
            <div
              className="absolute top-3 md:top-5 left-1/2 -translate-x-1/2 pl-4 pr-2 py-1.5 rounded-full shadow-lg text-sm font-medium text-white flex items-center gap-2 z-10 max-w-[75%] w-max"
              style={{ background: "#dc2626" }}
            >
              <span className="shrink-0">★</span>
              <span className="truncate">Destino: {destination.name}</span>
              <button
                onClick={() => setDestination(null)}
                className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Remover destino"
              >
                <XIcon />
              </button>
            </div>
          )}

          {/* Location information panel */}
          {selectedMapArea && (
            <LocationPanel
              location={selectedMapArea}
              isDestination={destination?.id === selectedMapArea.id}
              onClose={closePanel}
              onDirections={() => handleDirections(selectedMapArea)}
            />
          )}

          {/* Location error toast */}
          {showErrorToast && errorMessage && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl shadow-lg bg-slate-800 text-white text-xs font-medium z-20 max-w-[85%] text-center flex items-center gap-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-amber-400">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {errorMessage}
            </div>
          )}

          {/* Legend overlay */}
          {showLegend && (
            <div className="absolute left-3 md:left-4 bottom-3 md:bottom-4 bg-white rounded-xl shadow-lg border border-slate-200 p-4 min-w-44 z-10">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Legenda</p>
              <div className="space-y-2">
                {Object.entries(TYPE_COLORS).map(([type, cfg]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div className="w-4 h-3 rounded-sm border" style={{ background: cfg.fill, borderColor: cfg.stroke }} />
                    <span className="text-xs text-slate-600">{cfg.label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100 mt-1">
                  <div className="w-4 h-3 rounded-sm border-2" style={{ background: "#dc2626", borderColor: "#991b1b" }} />
                  <span className="text-xs text-slate-600">Selecionado</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{ background: "#2563eb" }} />
                  <span className="text-xs text-slate-600">Você está aqui</span>
                </div>
              </div>
            </div>
          )}

          {/* Zoom level badge */}
          <div className="absolute right-3 md:right-6 top-3 md:top-4 bg-white/80 backdrop-blur-sm rounded-md px-2 py-1 border border-slate-200 text-xs text-slate-500 z-10">
            {Math.round(zoom * 100)}%
          </div>
        </main>
      )}
    </div>
  )
}
