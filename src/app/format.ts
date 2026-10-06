import { CURRENCY } from "./config";
import type { Priority, SectionType } from "./api/types";

// ─── Section catalogue ───────────────────────────────────────────────────────
// Mirrors FarmManager.Domain.Constants.SectionTypeCatalog on the backend. The
// API returns each section's own colour/icon; this table supplies the defaults
// offered when creating a section.

export const SECTION_TYPES: Record<SectionType, { label: string; color: string; icon: string }> = {
  tomatoes:       { label: "Tomatoes",       color: "#d94832", icon: "🍅" },
  maize:          { label: "Maize / Corn",   color: "#e0a020", icon: "🌽" },
  beans:          { label: "Beans",          color: "#72b840", icon: "🫘" },
  potatoes:       { label: "Potatoes",       color: "#b08030", icon: "🥔" },
  sugarcane:      { label: "Sugarcane",      color: "#88c840", icon: "🎋" },
  garden:         { label: "Garden Veg",     color: "#38a068", icon: "🥬" },
  greenhouse:     { label: "Greenhouse",     color: "#40b0a0", icon: "🏠" },
  flowers:        { label: "Flowers",        color: "#c848a0", icon: "🌸" },
  orchard:        { label: "Orchard",        color: "#8a5020", icon: "🌳" },
  bush:           { label: "Bush / Natural", color: "#5a9142", icon: "🌿" },
  fallow:         { label: "Fallow Ground",  color: "#a0825a", icon: "🪨" },
  walkway:        { label: "Walkway / Road", color: "#b09070", icon: "🛤" },
  irrigation:     { label: "Irrigation",     color: "#3890c0", icon: "💧" },
  infrastructure: { label: "Structure",      color: "#64839e", icon: "🏗" },
  waterPump:      { label: "Water Pump",     color: "#1f6fb0", icon: "🚰" },
  pipe:           { label: "Water Pipe",     color: "#5b9bd5", icon: "🔗" },
  sprinkler:      { label: "Sprinkler",      color: "#4fc3f7", icon: "🚿" },
};

export const TYPE_KEYS = Object.keys(SECTION_TYPES) as SectionType[];
export const PRESET_COLORS = TYPE_KEYS.map(k => SECTION_TYPES[k].color);
export const EMPTY_COLOR = "#1a2c18";

export const iconFor = (type: SectionType | string) => SECTION_TYPES[type as SectionType]?.icon ?? "▫️";
export const labelFor = (type: SectionType | string) => SECTION_TYPES[type as SectionType]?.label ?? String(type);

// ─── Formatting ──────────────────────────────────────────────────────────────

const money = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export const fmtMoney = (n: number) => `${CURRENCY} ${money.format(n)}`;

export const fmtMoneyShort = (n: number) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}${CURRENCY} ${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${CURRENCY} ${(abs / 1_000).toFixed(0)}k`;
  return `${sign}${CURRENCY} ${Math.round(abs)}`;
};

export const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const parsed = new Date(`${d}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return d; // free-text such as "Year-round"
  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Today's date in the user's own time zone as yyyy-MM-dd (toISOString would give the UTC date). */
export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const priorityColor = (p: Priority) => (p === "high" ? "#d94832" : p === "medium" ? "#e0a020" : "#72b840");

// ─── Land maths ──────────────────────────────────────────────────────────────

const SQ_M_PER_ACRE = 4046.8564224;

export const cellsToSquareMeters = (cells: number, cellSizeM: number) => cells * cellSizeM * cellSizeM;
export const cellsToAcres = (cells: number, cellSizeM: number) => cellsToSquareMeters(cells, cellSizeM) / SQ_M_PER_ACRE;
export const fmtAcres = (cells: number, cellSizeM: number) => cellsToAcres(cells, cellSizeM).toFixed(2);
export const metersToAcres = (w: number, h: number) => (w * h) / SQ_M_PER_ACRE;

/** Largest farm side the map editor offers (the API itself allows more). Keeps the canvas well inside browser limits. */
export const UI_MIN_FARM_METERS = 50;
export const UI_MAX_FARM_METERS = 2000;
