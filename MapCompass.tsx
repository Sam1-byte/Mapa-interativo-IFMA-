import { XIcon } from "./icons"

// ---------------------------------------------------------------------------
// Compass indicator
// ---------------------------------------------------------------------------

interface MapCompassProps {
  /** Screen angle (deg clockwise from up) where geographic north is; null = not calibrated */
  northAngle: number | null
  /** True when the map is rotated away from its original orientation */
  isRotated: boolean
  onReset: () => void
}

export function MapCompass({ northAngle, isRotated, onReset }: MapCompassProps) {
  if (northAngle === null) return null

  const calibrated = true
  const label = isRotated
      ? "Bússola: o norte está indicado pela seta vermelha. Ativar para restaurar a orientação original do mapa"
      : "Bússola: o norte está indicado pela seta vermelha"

  const dial = (
    <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="white" stroke={calibrated ? "#cbd5e1" : "#cbd5e1"} strokeWidth="1.5" strokeDasharray={calibrated ? undefined : "3 3"} />
      {calibrated ? (
        <g transform={`rotate(${northAngle} 24 24)`}>
          <polygon points="24,6 29,24 19,24" fill="#dc2626" />
          <polygon points="24,42 29,24 19,24" fill="#94a3b8" />
          <circle cx="24" cy="24" r="2" fill="white" />
        </g>
      ) : (
        <text x="24" y="29" textAnchor="middle" fontSize="15" fontWeight="700" fill="#94a3b8">N?</text>
      )}
    </svg>
  )

  const base = "absolute left-5 top-5 md:left-9 md:top-9 z-10 h-11 w-11 rounded-full shadow-md"

  return isRotated ? (
    <button
      onClick={onReset}
      className={`${base} focus:outline-none focus:ring-2 focus:ring-[#1a6b3c]/50`}
      aria-label={label}
      title="Restaurar orientação original"
    >
      {dial}
    </button>
  ) : (
    <div className={base} role="img" aria-label={label} title={calibrated ? "Norte" : "Norte não configurado"}>
      {dial}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toggle button
// ---------------------------------------------------------------------------

interface OrientationButtonProps {
  active: boolean
  requesting: boolean
  /** false when the image's north angle is not configured */
  available: boolean
  onClick: () => void
}

export function OrientationButton({ active, requesting, available, onClick }: OrientationButtonProps) {
  const title = !available
    ? "Orientação automática indisponível"
    : active
      ? "Desativar orientação automática"
      : "Ativar orientação automática"
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-disabled={!available}
      aria-label={title}
      title={title}
      className={[
        "w-9 h-9 rounded-lg border shadow-sm flex items-center justify-center transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#1a6b3c]/40",
        active
          ? "bg-[#1a6b3c] border-[#1a6b3c] text-white"
          : available
            ? "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            : "bg-slate-100 border-slate-200 text-slate-300",
        requesting ? "animate-pulse" : "",
      ].join(" ")}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="12 2 19 21 12 17 5 21 12 2" />
      </svg>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Notice card (explanation before permission, errors, limitations)
// ---------------------------------------------------------------------------

export interface OrientationNoticeData {
  kind: "explain" | "info" | "error"
  title: string
  text: string
}

export function OrientationNotice({
  notice,
  onConfirm,
  onClose,
}: {
  notice: OrientationNoticeData
  onConfirm: () => void
  onClose: () => void
}) {
  const tone =
    notice.kind === "error"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-slate-200 bg-white text-slate-700"
  return (
    <div
      role={notice.kind === "explain" ? "dialog" : "status"}
      aria-live="polite"
      aria-label={notice.title}
      className={`absolute left-5 top-[4.5rem] md:left-9 md:top-[5.25rem] z-20 w-[min(20rem,calc(100%-2.5rem))] rounded-xl border p-3.5 shadow-xl ${tone}`}
    >
      <div className="flex items-start gap-2">
        <p className="flex-1 text-sm font-semibold">{notice.title}</p>
        <button
          onClick={onClose}
          className="-m-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg opacity-60 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#1a6b3c]/40"
          aria-label="Fechar aviso"
        >
          <XIcon />
        </button>
      </div>
      <p className="mt-1 text-xs leading-relaxed opacity-90">{notice.text}</p>
      {notice.kind === "explain" && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={onConfirm}
            className="min-h-10 flex-1 rounded-lg bg-[#1a6b3c] px-3 text-sm font-semibold text-white hover:bg-[#155a32] focus:outline-none focus:ring-2 focus:ring-[#1a6b3c]/40 focus:ring-offset-2"
          >
            Ativar sensores
          </button>
          <button
            onClick={onClose}
            className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#1a6b3c]/40"
          >
            Agora não
          </button>
        </div>
      )}
    </div>
  )
}
