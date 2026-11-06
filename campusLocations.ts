import type { CampusLocation, CampusLocationType } from "../types/location"

// ---------------------------------------------------------------------------
// Single source of truth for map areas, search, shortcuts and info panel.
//
// TODO (manual): every entry below has dataStatus "illustrative". Texts, services
// and tips marked "(exemplo)" are placeholders, NOT confirmed IFMA information.
// Replace them with real data and set dataStatus to "confirmed".
// `building: null` means the building/area is not yet registered.
// ---------------------------------------------------------------------------

export const CAMPUS_LOCATIONS: CampusLocation[] = [
  {
    id: "predio-principal",
    name: "Prédio principal do IFMA",
    type: "building",
    points:
      "177,461 559,461 559,542 532,542 547,681 565,681 565,807 158,807 158,682 207,682 207,544 177,544",
    description:
      "Edificação central do campus. Descrição ilustrativa, a ser substituída por texto oficial.",
    building: "Prédio principal",
    services: [
      { name: "Setor administrativo (exemplo)" },
      { name: "Salas de aula (exemplo)" },
      { name: "Atendimento ao público (exemplo)" },
    ],
    tips: [
      "Orientação ilustrativa: procure a recepção para saber qual setor atende à sua necessidade.",
    ],
    dataStatus: "illustrative",
  },
  {
    id: "refeitorio",
    name: "Refeitório",
    type: "dining",
    points: "380,226 571,226 571,342 380,342",
    description:
      "Espaço destinado a refeições. Descrição ilustrativa, a ser substituída por texto oficial.",
    building: null,
    services: [{ name: "Alimentação (exemplo)" }],
    tips: [],
    dataStatus: "illustrative",
  },
  {
    id: "quadra",
    name: "Quadra",
    type: "sport",
    points: "655,136 952,136 952,338 655,338",
    description:
      "Área para práticas esportivas. Descrição ilustrativa, a ser substituída por texto oficial.",
    building: null,
    services: [{ name: "Prática esportiva (exemplo)" }],
    tips: [],
    dataStatus: "illustrative",
  },
  {
    id: "piscina",
    name: "Piscina",
    type: "leisure",
    points: "747,507 872,507 872,726 747,726",
    description:
      "Área aquática do campus. Descrição ilustrativa, a ser substituída por texto oficial.",
    building: null,
    services: [{ name: "Atividades aquáticas (exemplo)" }],
    tips: [],
    dataStatus: "illustrative",
  },
  {
    id: "estacionamento",
    name: "Estacionamento",
    type: "parking",
    points: "799,850 1075,850 1088,1083 799,1083",
    description:
      "Área para estacionamento de veículos. Descrição ilustrativa, a ser substituída por texto oficial.",
    building: null,
    services: [{ name: "Vagas de veículos (exemplo)" }],
    tips: [],
    dataStatus: "illustrative",
  },
  {
    id: "entrada",
    name: "Entrada",
    type: "access",
    points: "225,1024 391,1024 391,1081 225,1081",
    description:
      "Acesso ao campus. Descrição ilustrativa, a ser substituída por texto oficial.",
    building: null,
    services: [{ name: "Acesso e orientação a visitantes (exemplo)" }],
    tips: [],
    dataStatus: "illustrative",
  },
]

export const TYPE_COLORS: Record<
  CampusLocationType,
  { fill: string; stroke: string; label: string }
> = {
  building: { fill: "#f0fdf4", stroke: "#86efac", label: "Edificação" },
  dining: { fill: "#ffffff", stroke: "#e5e7eb", label: "Alimentação" },
  sport: { fill: "#bbf7d0", stroke: "#22c55e", label: "Esporte" },
  leisure: { fill: "#dcfce7", stroke: "#4ade80", label: "Lazer" },
  parking: { fill: "#f3f4f6", stroke: "#d1d5db", label: "Estacionamento" },
  access: { fill: "#fee2e2", stroke: "#f87171", label: "Acesso" },
}

export function typeIcon(type: CampusLocationType) {
  switch (type) {
    case "building": return "🏛️"
    case "dining": return "🍽️"
    case "sport": return "⚽"
    case "leisure": return "🏊"
    case "parking": return "🅿️"
    case "access": return "🚪"
  }
}

export function getLocation(id: string) {
  return CAMPUS_LOCATIONS.find((l) => l.id === id) ?? null
}

export function searchLocations(query: string): CampusLocation[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return CAMPUS_LOCATIONS.filter((l) =>
    [
      l.name,
      l.building ?? "",
      TYPE_COLORS[l.type].label,
      l.description ?? "",
      ...l.services.map((s) => s.name),
    ].some((field) => field.toLowerCase().includes(q)),
  )
}

/** Centroid of the polygon's bounding box, in map image space. */
export function locationCenter(loc: CampusLocation) {
  const pts = loc.points.split(" ").map((p) => p.split(",").map(Number))
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  }
}
