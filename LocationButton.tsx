import type { LocationStatus } from "../../types/location"

interface LocationButtonProps {
  status: LocationStatus
  onClick: () => void
}

export function LocationButton({ status, onClick }: LocationButtonProps) {
  const isLoading = status === "requesting"
  const isActive = status === "available"
  const isError = status === "denied" || status === "error" || status === "unavailable"

  const title = isError
    ? "Erro — toque para tentar novamente"
    : isActive
      ? "Centralizar na minha localização"
      : "Minha localização"

  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={[
        "w-9 h-9 rounded-lg border shadow-sm flex items-center justify-center transition-all active:scale-95",
        isActive
          ? "bg-[#1a6b3c] border-[#1a6b3c] text-white"
          : isError
            ? "bg-red-50 border-red-200 text-red-500 hover:bg-red-100"
            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50",
      ].join(" ")}
    >
      {isLoading ? (
        <SpinnerIcon />
      ) : isError ? (
        <AlertIcon />
      ) : (
        <LocationIcon active={isActive} />
      )}
    </button>
  )
}

function LocationIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="animate-spin"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}
