import { useState, useRef, useEffect, useMemo } from "react";
import {
  Map as MapIcon, CheckSquare2, TrendingUp, Plus, Trash2, ZoomIn, ZoomOut,
  Pencil, Eraser, X, Check, Calendar, AlertTriangle,
  Leaf, Droplets, ArrowUpRight, ArrowDownRight, Clock,
  ChevronDown, ChevronUp, Settings2, Maximize2
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

type SectionType =
  | "tomatoes" | "maize" | "beans" | "garden" | "walkway"
  | "irrigation" | "bush" | "orchard" | "fallow" | "infrastructure"
  | "greenhouse" | "flowers" | "sugarcane" | "potatoes";

type Priority = "low" | "medium" | "high";
type FinanceType = "income" | "expense";
type Tool = "draw" | "erase";
type TabId = "map" | "sections" | "activities" | "finance";

interface Section {
  id: string; name: string; type: SectionType; color: string;
  cropDetails: string; plantDate: string; harvestDate: string;
  waterSchedule: string; notes: string;
}
interface Task {
  id: string; title: string; sectionId: string; dueDate: string;
  priority: Priority; done: boolean; completedDate: string;
  estimatedCost: number; notes: string;
}
interface FinanceRecord {
  id: string; date: string; type: FinanceType; category: string;
  amount: number; description: string; sectionId: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CELL_M = 5; // metres per cell side
const INIT_COLS = 40;
const INIT_ROWS = 40;
const ZOOM_SIZES = [7, 12, 19, 30, 48];

const TYPE_CFG: Record<string, { label: string; color: string; icon: string }> = {
  tomatoes:       { label: "Tomatoes",       color: "#d94832", icon: "🍅" },
  maize:          { label: "Maize / Corn",   color: "#e0a020", icon: "🌽" },
  beans:          { label: "Beans",          color: "#72b840", icon: "🫘" },
  potatoes:       { label: "Potatoes",       color: "#b08030", icon: "🥔" },
  sugarcane:      { label: "Sugarcane",      color: "#88c840", icon: "🎋" },
  garden:         { label: "Garden Veg",     color: "#38a068", icon: "🥬" },
  greenhouse:     { label: "Greenhouse",     color: "#40b0a0", icon: "🏠" },
  flowers:        { label: "Flowers",        color: "#c848a0", icon: "🌸" },
  orchard:        { label: "Orchard",        color: "#8a5020", icon: "🌳" },
  bush:           { label: "Bush / Natural", color: "#285828", icon: "🌿" },
  fallow:         { label: "Fallow Ground",  color: "#706050", icon: "🪨" },
  walkway:        { label: "Walkway / Road", color: "#b09070", icon: "🛤" },
  irrigation:     { label: "Irrigation",     color: "#3890c0", icon: "💧" },
  infrastructure: { label: "Structure",      color: "#585858", icon: "🏗" },
};

const TYPE_KEYS = Object.keys(TYPE_CFG) as SectionType[];
const PRESET_COLORS = TYPE_KEYS.map(k => TYPE_CFG[k].color);
const EMPTY_COLOR = "#1a2c18";

// ─── Initial grid ─────────────────────────────────────────────────────────────

function buildGrid(cols = INIT_COLS, rows = INIT_ROWS): (string | null)[] {
  const g = new Array<string | null>(cols * rows).fill(null);
  const fill = (c0: number, r0: number, c1: number, r1: number, id: string) => {
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++)
        if (r < rows && c < cols) g[r * cols + c] = id;
  };
  fill(0,  0,  15, 26, "s-maize");
  fill(19, 0,  37, 15, "s-tomatoes");
  fill(38, 0,  39, 16, "s-irrigation");
  fill(0,  30, 15, 39, "s-orchard");
  fill(19, 20, 30, 28, "s-beans");
  fill(31, 20, 37, 28, "s-garden");
  fill(19, 30, 37, 39, "s-bush");
  fill(0,  27, 39, 28, "s-walkway");
  fill(17, 0,  18, 39, "s-walkway");
  return g;
}

const INIT_SECTIONS: Section[] = [
  { id: "s-maize",      name: "Main Maize Field",    type: "maize",      color: "#e0a020", cropDetails: "H614D Hybrid, rows 75 cm apart", plantDate: "2026-03-15", harvestDate: "2026-07-20", waterSchedule: "Twice weekly",    notes: "Top-dressed at 6 weeks" },
  { id: "s-tomatoes",   name: "North Tomatoes",      type: "tomatoes",   color: "#d94832", cropDetails: "Roma & Beefsteak, staked",        plantDate: "2026-04-01", harvestDate: "2026-08-30", waterSchedule: "Daily drip",       notes: "Weekly pest control" },
  { id: "s-orchard",    name: "South Orchard",       type: "orchard",    color: "#8a5020", cropDetails: "Mango, Avocado, Citrus",          plantDate: "2024-06-01", harvestDate: "Year-round", waterSchedule: "Weekly deep",      notes: "Established trees" },
  { id: "s-beans",      name: "Export Bean Patch",   type: "beans",      color: "#72b840", cropDetails: "French beans for export",         plantDate: "2026-05-10", harvestDate: "2026-08-15", waterSchedule: "Every 2 days",    notes: "Harvest at dawn" },
  { id: "s-garden",     name: "Vegetable Garden",    type: "garden",     color: "#38a068", cropDetails: "Kale, Spinach, Onions, Garlic",  plantDate: "2026-04-20", harvestDate: "Continuous", waterSchedule: "Daily",           notes: "Succession planting" },
  { id: "s-bush",       name: "Natural Bush Reserve",type: "bush",       color: "#285828", cropDetails: "Indigenous vegetation",          plantDate: "",           harvestDate: "",           waterSchedule: "Rain-fed",         notes: "Wildlife corridor — do not clear" },
  { id: "s-irrigation", name: "Irrigation Channel",  type: "irrigation", color: "#3890c0", cropDetails: "Main water distribution",        plantDate: "",           harvestDate: "",           waterSchedule: "Continuous flow",  notes: "Check pressure weekly" },
  { id: "s-walkway",    name: "Farm Walkways",       type: "walkway",    color: "#b09070", cropDetails: "Access paths and farm roads",    plantDate: "",           harvestDate: "",           waterSchedule: "",                 notes: "Gravel-surfaced" },
];

const TODAY = new Date().toISOString().split("T")[0];

const INIT_TASKS: Task[] = [
  { id: "t1", title: "Water tomato section — check drip pressure",  sectionId: "s-tomatoes",   dueDate: "2026-08-12", priority: "high",   done: false, completedDate: "", estimatedCost: 0,    notes: "" },
  { id: "t2", title: "Apply NPK fertilizer to maize (200 kg CAN)",  sectionId: "s-maize",      dueDate: "2026-08-14", priority: "high",   done: false, completedDate: "", estimatedCost: 4500, notes: "Use ratio 23:10:5" },
  { id: "t3", title: "Harvest French beans — rows A to D",          sectionId: "s-beans",      dueDate: "2026-08-15", priority: "high",   done: false, completedDate: "", estimatedCost: 1200, notes: "Pack immediately, export due Aug 16" },
  { id: "t4", title: "Weed vegetable garden beds",                  sectionId: "s-garden",     dueDate: "2026-08-08", priority: "medium", done: false, completedDate: "", estimatedCost: 800,  notes: "Overdue" },
  { id: "t5", title: "Inspect and clear irrigation channel",        sectionId: "s-irrigation", dueDate: "2026-08-10", priority: "medium", done: true,  completedDate: "2026-08-10", estimatedCost: 0, notes: "Found minor blockage, cleared" },
  { id: "t6", title: "Prune citrus trees in orchard",               sectionId: "s-orchard",    dueDate: "2026-08-22", priority: "low",    done: false, completedDate: "", estimatedCost: 1500, notes: "" },
  { id: "t7", title: "Organic pyrethrin pest spray",                sectionId: "s-tomatoes",   dueDate: "2026-08-07", priority: "high",   done: true,  completedDate: "2026-08-07", estimatedCost: 2200, notes: "Applied at dusk" },
  { id: "t8", title: "Prepare tomato seedlings for next season",    sectionId: "",             dueDate: "2026-08-28", priority: "medium", done: false, completedDate: "", estimatedCost: 500,  notes: "" },
  { id: "t9", title: "Repair boundary fence — north edge",          sectionId: "",             dueDate: "2026-08-18", priority: "medium", done: false, completedDate: "", estimatedCost: 3500, notes: "" },
];

const INIT_FINANCES: FinanceRecord[] = [
  { id: "f1",  date: "2026-02-15", type: "income",  category: "Crop Sale",        amount: 85000, description: "Maize first harvest — 5 tonnes",          sectionId: "s-maize" },
  { id: "f2",  date: "2026-02-01", type: "expense", category: "Seeds",            amount: 12000, description: "H614D hybrid maize seeds — 80 kg",         sectionId: "s-maize" },
  { id: "f3",  date: "2026-02-10", type: "expense", category: "Fertilizer",       amount: 28000, description: "NPK basal dressing — 600 kg",              sectionId: "s-maize" },
  { id: "f4",  date: "2026-03-05", type: "expense", category: "Labor",            amount: 15000, description: "Planting labor — 20 workers × 3 days",     sectionId: "" },
  { id: "f5",  date: "2026-03-20", type: "income",  category: "Crop Sale",        amount: 42000, description: "Bean export batch 1 — 800 kg",             sectionId: "s-beans" },
  { id: "f6",  date: "2026-03-15", type: "expense", category: "Seeds",            amount: 8500,  description: "Tomato seedlings + bean seeds",            sectionId: "" },
  { id: "f7",  date: "2026-04-05", type: "expense", category: "Pesticides",       amount: 9200,  description: "Fungicide and insecticide spray",          sectionId: "" },
  { id: "f8",  date: "2026-04-10", type: "income",  category: "Crop Sale",        amount: 18500, description: "Orchard citrus — 2 tonnes",                sectionId: "s-orchard" },
  { id: "f9",  date: "2026-04-20", type: "expense", category: "Water/Irrigation", amount: 4800,  description: "Irrigation electricity April",             sectionId: "" },
  { id: "f10", date: "2026-05-05", type: "income",  category: "Crop Sale",        amount: 67000, description: "Tomato sales — 3 tonnes to market",        sectionId: "s-tomatoes" },
  { id: "f11", date: "2026-05-10", type: "expense", category: "Labor",            amount: 18000, description: "Weeding and maintenance",                  sectionId: "" },
  { id: "f12", date: "2026-06-01", type: "expense", category: "Equipment",        amount: 35000, description: "Tractor service + parts",                  sectionId: "" },
  { id: "f13", date: "2026-06-18", type: "income",  category: "Crop Sale",        amount: 38000, description: "Bean export batch 2 — 750 kg",             sectionId: "s-beans" },
  { id: "f14", date: "2026-07-05", type: "expense", category: "Fertilizer",       amount: 14000, description: "Top dressing CAN — 400 kg",                sectionId: "s-maize" },
  { id: "f15", date: "2026-07-20", type: "expense", category: "Labor",            amount: 22000, description: "Harvest labor",                            sectionId: "" },
  { id: "f16", date: "2026-07-22", type: "income",  category: "Crop Sale",        amount: 54000, description: "Garden vegetables — Q2 total",             sectionId: "s-garden" },
  { id: "f17", date: "2026-08-01", type: "expense", category: "Water/Irrigation", amount: 5200,  description: "Irrigation electricity August",            sectionId: "" },
  { id: "f18", date: "2026-08-05", type: "income",  category: "Crop Sale",        amount: 31000, description: "Mango harvest — 1.5 tonnes",               sectionId: "s-orchard" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtKES       = (n: number) => `KES ${n.toLocaleString()}`;
const cellsToAcres = (c: number) => ((c * CELL_M * CELL_M) / 4047).toFixed(2);
const cellsToM2    = (c: number) => (c * CELL_M * CELL_M).toLocaleString();
const fmtDate      = (d: string) => {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
};
const priorityColor = (p: Priority) => p === "high" ? "#d94832" : p === "medium" ? "#e0a020" : "#72b840";
const isOverdue     = (t: Task)    => !t.done && t.dueDate < TODAY;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab]           = useState<TabId>("map");
  const [gridData, setGridData] = useState<(string | null)[]>(buildGrid);
  const [sections, setSections] = useState<Section[]>(INIT_SECTIONS);
  const [tasks, setTasks]       = useState<Task[]>(INIT_TASKS);
  const [finances, setFinances] = useState<FinanceRecord[]>(INIT_FINANCES);

  const [activeTool,    setActiveTool]    = useState<Tool>("draw");
  const [selectedSecId, setSelectedSecId] = useState("s-maize");
  const [zoomIdx,       setZoomIdx]       = useState(1);
  const [hoveredCell,   setHoveredCell]   = useState<{ r: number; c: number } | null>(null);

  const [taskFilter, setTaskFilter] = useState<"all" | "pending" | "done">("all");
  const [finFilter,  setFinFilter]  = useState<"all" | "income" | "expense">("all");

  type ModalKind =
    | { type: "addSection" } | { type: "editSection"; id: string }
    | { type: "addTask" }    | { type: "addFinance" };
  const [modal,   setModal]   = useState<ModalKind | null>(null);
  const [secForm, setSecForm] = useState<Partial<Section>>({});
  const [taskForm,setTaskForm]= useState<Partial<Task>>({});
  const [finForm, setFinForm] = useState<Partial<FinanceRecord>>({});

  // ── farm dimension state ──
  const [farmW,      setFarmW]      = useState(200); // confirmed metres
  const [farmH,      setFarmH]      = useState(200);
  const [pendingW,   setPendingW]   = useState(200); // edit-in-progress
  const [pendingH,   setPendingH]   = useState(200);
  const [showResize, setShowResize] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const cellSize  = ZOOM_SIZES[zoomIdx];

  // Dynamic grid dimensions derived from farm size
  const gridCols = Math.max(10, Math.round(farmW / CELL_M));
  const gridRows = Math.max(10, Math.round(farmH / CELL_M));

  // ── derived ──
  const sectionMap = useMemo(() => new Map(sections.map(s => [s.id, s])), [sections]);

  const cellCounts = useMemo(() => {
    const c: Record<string, number> = {};
    gridData.forEach(id => { if (id) c[id] = (c[id] ?? 0) + 1; });
    return c;
  }, [gridData]);

  const totalFilled  = gridData.filter(Boolean).length;
  const totalCells   = gridCols * gridRows;
  const pendingTasks = tasks.filter(t => !t.done);
  const todayTasks   = tasks.filter(t => !t.done && t.dueDate === TODAY);

  const totalIncome  = useMemo(() => finances.filter(f => f.type === "income").reduce((s, f)  => s + f.amount, 0), [finances]);
  const totalExpense = useMemo(() => finances.filter(f => f.type === "expense").reduce((s, f)  => s + f.amount, 0), [finances]);

  const monthlyData = useMemo(() => {
    const map: Record<string, { income: number; expense: number }> = {};
    finances.forEach(f => {
      const k = f.date.slice(0, 7);
      if (!map[k]) map[k] = { income: 0, expense: 0 };
      map[k][f.type] += f.amount;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({
        name: MONTHS[+k.slice(5, 7) - 1],
        income: v.income, expense: v.expense, profit: v.income - v.expense,
      }));
  }, [finances]);

  const projectedAnnual = useMemo(() => {
    if (!monthlyData.length) return 0;
    const recent = monthlyData.slice(-3);
    return Math.round(recent.reduce((s, m) => s + m.income, 0) / recent.length * 12);
  }, [monthlyData]);

  const cumulativeData = useMemo(() => {
    let cum = 0;
    return monthlyData.map(m => { cum += m.profit; return { name: m.name, cumulative: cum }; });
  }, [monthlyData]);

  // Land use breakdown sorted by acreage
  const landUse = useMemo(() =>
    sections
      .map(s => ({ sec: s, cells: cellCounts[s.id] ?? 0 }))
      .filter(x => x.cells > 0)
      .sort((a, b) => b.cells - a.cells),
    [sections, cellCounts]
  );

  // ── farm resize ───────────────────────────────────────────────────────────────
  const applyResize = () => {
    const newW = Math.max(50, pendingW);
    const newH = Math.max(50, pendingH);
    const oldCols = gridCols;
    const oldRows = gridRows;
    const newCols = Math.max(10, Math.round(newW / CELL_M));
    const newRows = Math.max(10, Math.round(newH / CELL_M));

    const newGrid = new Array<string | null>(newCols * newRows).fill(null);
    for (let r = 0; r < Math.min(oldRows, newRows); r++)
      for (let c = 0; c < Math.min(oldCols, newCols); c++)
        newGrid[r * newCols + c] = gridData[r * oldCols + c];

    setGridData(newGrid);
    setFarmW(newW);
    setFarmH(newH);
    setPendingW(newW);
    setPendingH(newH);
    setShowResize(false);
  };

  // ── canvas drawing ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cw = gridCols * cellSize;
    const ch = gridRows * cellSize;
    if (canvas.width  !== cw) canvas.width  = cw;
    if (canvas.height !== ch) canvas.height = ch;

    // background
    ctx.fillStyle = EMPTY_COLOR;
    ctx.fillRect(0, 0, cw, ch);

    // section colour fills
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const sid = gridData[r * gridCols + c];
        if (sid) {
          ctx.fillStyle = sectionMap.get(sid)?.color ?? "#555";
          ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
        }
      }
    }

    // minor grid lines
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= gridRows; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * cellSize); ctx.lineTo(cw, r * cellSize); ctx.stroke();
    }
    for (let c = 0; c <= gridCols; c++) {
      ctx.beginPath(); ctx.moveTo(c * cellSize, 0); ctx.lineTo(c * cellSize, ch); ctx.stroke();
    }

    // major grid lines every 10 cells (50 m)
    ctx.strokeStyle = "rgba(255,255,255,0.13)";
    ctx.lineWidth = 1;
    for (let r = 0; r <= gridRows; r += 10) {
      ctx.beginPath(); ctx.moveTo(0, r * cellSize); ctx.lineTo(cw, r * cellSize); ctx.stroke();
    }
    for (let c = 0; c <= gridCols; c += 10) {
      ctx.beginPath(); ctx.moveTo(c * cellSize, 0); ctx.lineTo(c * cellSize, ch); ctx.stroke();
    }

    // metre rulers along edges at medium+ zoom
    if (cellSize >= 19) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = `${Math.max(8, Math.floor(cellSize * 0.28))}px 'JetBrains Mono'`;
      ctx.textAlign = "center";
      for (let c = 0; c <= gridCols; c += 10)
        ctx.fillText(`${c * CELL_M}m`, c * cellSize, 9);
      ctx.textAlign = "right";
      for (let r = 0; r <= gridRows; r += 10)
        ctx.fillText(`${r * CELL_M}m`, cw - 2, r * cellSize + 10);
    }

    // hover highlight
    if (hoveredCell) {
      const { r, c } = hoveredCell;
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(c * cellSize + 0.5, r * cellSize + 0.5, cellSize - 1, cellSize - 1);
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(c * cellSize + 0.5, r * cellSize + 0.5, cellSize - 1, cellSize - 1);
    }

    // ── Section labels + icons at centroid ──────────────────────────────────────
    // Compute centroid of each section from gridData
    const centroids: Record<string, { sumC: number; sumR: number; count: number }> = {};
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const sid = gridData[r * gridCols + c];
        if (sid) {
          if (!centroids[sid]) centroids[sid] = { sumC: 0, sumR: 0, count: 0 };
          centroids[sid].sumC += c;
          centroids[sid].sumR += r;
          centroids[sid].count++;
        }
      }
    }

    sections.forEach(sec => {
      const cen = centroids[sec.id];
      if (!cen || cen.count < 2) return;

      const cx = (cen.sumC / cen.count + 0.5) * cellSize;
      const cy = (cen.sumR / cen.count + 0.5) * cellSize;
      const cfg = TYPE_CFG[sec.type];
      const icon = cfg?.icon ?? "?";
      const acres = cellsToAcres(cen.count);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (cellSize >= 12) {
        // Draw icon — emoji font
        const iconSz = Math.min(Math.max(cellSize * 0.9, 10), 28);
        ctx.font = `${iconSz}px serif`;
        ctx.fillText(icon, cx, cy);
      }

      if (cellSize >= 19) {
        // Section name below icon
        const nameSz = Math.max(8, Math.min(cellSize * 0.28, 13));
        ctx.font = `600 ${nameSz}px 'Instrument Sans', sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        // Subtle shadow for readability
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 3;
        ctx.fillText(sec.name, cx, cy + Math.min(cellSize * 0.7, 22));
        ctx.shadowBlur = 0;

        // Acreage line
        const acSz = Math.max(7, Math.min(cellSize * 0.22, 11));
        ctx.font = `${acSz}px 'JetBrains Mono', monospace`;
        ctx.fillStyle = "rgba(255,255,255,0.65)";
        ctx.fillText(`${acres} ac`, cx, cy + Math.min(cellSize * 0.7, 22) + acSz + 2);
        ctx.shadowBlur = 0;
      }

      if (cellSize >= 30 && sec.cropDetails) {
        // Variety line
        const varSz = Math.max(7, Math.min(cellSize * 0.2, 10));
        const offset = Math.min(cellSize * 0.7, 22) + (Math.max(7, Math.min(cellSize * 0.22, 11)) + 2) + varSz + 3;
        ctx.font = `italic ${varSz}px 'Instrument Sans', sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        const short = sec.cropDetails.length > 20 ? sec.cropDetails.slice(0, 18) + "…" : sec.cropDetails;
        ctx.fillText(short, cx, cy + offset);
      }
    });

  }, [gridData, sections, sectionMap, gridCols, gridRows, cellSize, hoveredCell]);

  // ── canvas mouse handlers ─────────────────────────────────────────────────────
  const getCell = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) / cellSize);
    const r = Math.floor((e.clientY - rect.top)  / cellSize);
    return (r >= 0 && r < gridRows && c >= 0 && c < gridCols) ? { r, c } : null;
  };

  const paint = (r: number, c: number) => {
    const idx = r * gridCols + c;
    setGridData(prev => {
      const next = [...prev];
      next[idx] = activeTool === "draw" ? selectedSecId : null;
      return next;
    });
  };

  const onMouseDown  = (e: React.MouseEvent<HTMLCanvasElement>) => { if (e.button !== 0) return; isDrawing.current = true; const cell = getCell(e); if (cell) paint(cell.r, cell.c); };
  const onMouseMove  = (e: React.MouseEvent<HTMLCanvasElement>) => { const cell = getCell(e); setHoveredCell(cell); if (isDrawing.current && cell) paint(cell.r, cell.c); };
  const onMouseUp    = () => { isDrawing.current = false; };
  const onMouseLeave = () => { isDrawing.current = false; setHoveredCell(null); };

  // ── section handlers ──────────────────────────────────────────────────────────
  const saveSection = () => {
    if (!secForm.name) return;
    if (modal?.type === "addSection") {
      const ns: Section = {
        id: `s-${Date.now()}`, name: secForm.name!, type: (secForm.type ?? "garden") as SectionType,
        color: secForm.color ?? TYPE_CFG[secForm.type ?? "garden"]?.color ?? "#72b840",
        cropDetails: secForm.cropDetails ?? "", plantDate: secForm.plantDate ?? "",
        harvestDate: secForm.harvestDate ?? "", waterSchedule: secForm.waterSchedule ?? "",
        notes: secForm.notes ?? "",
      };
      setSections(p => [...p, ns]);
      setSelectedSecId(ns.id);
    } else if (modal?.type === "editSection") {
      setSections(p => p.map(s => s.id === modal.id ? { ...s, ...secForm } : s));
    }
    setModal(null); setSecForm({});
  };
  const deleteSection = (id: string) => {
    setSections(p => p.filter(s => s.id !== id));
    setGridData(p => p.map(sid => sid === id ? null : sid));
  };

  // ── task handlers ─────────────────────────────────────────────────────────────
  const toggleTask   = (id: string) => setTasks(p => p.map(t => t.id === id ? { ...t, done: !t.done, completedDate: !t.done ? TODAY : "" } : t));
  const deleteTask   = (id: string) => setTasks(p => p.filter(t => t.id !== id));
  const saveTask     = () => {
    if (!taskForm.title) return;
    setTasks(p => [...p, { id: `t-${Date.now()}`, title: taskForm.title!, sectionId: taskForm.sectionId ?? "",
      dueDate: taskForm.dueDate ?? TODAY, priority: (taskForm.priority ?? "medium") as Priority,
      done: false, completedDate: "", estimatedCost: Number(taskForm.estimatedCost) || 0, notes: taskForm.notes ?? "" }]);
    setModal(null); setTaskForm({});
  };

  // ── finance handlers ──────────────────────────────────────────────────────────
  const saveFinance   = () => {
    if (!finForm.description || !finForm.amount) return;
    setFinances(p => [...p, { id: `f-${Date.now()}`, date: finForm.date ?? TODAY,
      type: (finForm.type ?? "expense") as FinanceType, category: finForm.category ?? "Other",
      amount: Number(finForm.amount), description: finForm.description!, sectionId: finForm.sectionId ?? "" }]);
    setModal(null); setFinForm({});
  };
  const deleteFinance = (id: string) => setFinances(p => p.filter(f => f.id !== id));

  const inp = "w-full bg-[#1a2d16] border border-[rgba(122,182,72,0.2)] rounded px-3 py-2 text-sm text-[#ddefd4] placeholder-[#4a6a40] focus:outline-none focus:border-[rgba(122,182,72,0.5)]";
  const lbl = "block text-[10px] font-mono text-[#6a8f5e] uppercase tracking-widest mb-1";

  const NAV: { id: TabId; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { id: "map",        label: "Farm Map",   icon: MapIcon },
    { id: "sections",   label: "Sections",   icon: Leaf },
    { id: "activities", label: "Activities", icon: CheckSquare2 },
    { id: "finance",    label: "Finance",    icon: TrendingUp },
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  // ── MAP TAB ───────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  const renderMap = () => {
    const hSec   = hoveredCell ? sectionMap.get(gridData[hoveredCell.r * gridCols + hoveredCell.c] ?? "") : null;
    const selSec = sectionMap.get(selectedSecId);
    const willShrink = pendingW < farmW || pendingH < farmH;

    return (
      <div className="flex h-full min-h-0">

        {/* ── Left panel ── */}
        <div className="w-48 flex-shrink-0 bg-[#0e1e0c] border-r border-[rgba(122,182,72,0.1)] flex flex-col overflow-y-auto">

          {/* Tools */}
          <div className="p-3 border-b border-[rgba(122,182,72,0.08)]">
            <p className={lbl}>Tools</p>
            <div className="flex gap-1.5">
              {([["draw", "Draw", Pencil], ["erase", "Erase", Eraser]] as const).map(([tool, label, Icon]) => (
                <button key={tool} onClick={() => setActiveTool(tool as Tool)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded text-[11px] transition-colors ${
                    activeTool === tool
                      ? tool === "draw" ? "bg-[#7ab648] text-[#0a1809]" : "bg-[#d94832] text-white"
                      : "bg-[#1a2d16] text-[#6a8f5e] hover:bg-[#243d20]"
                  }`}>
                  <Icon size={13} />{label}
                </button>
              ))}
            </div>
            {activeTool === "draw" && selSec && (
              <div className="mt-2 flex items-center gap-2 p-2 rounded bg-[#1a2d16] border border-[rgba(122,182,72,0.15)]">
                <span className="text-sm leading-none">{TYPE_CFG[selSec.type]?.icon}</span>
                <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: selSec.color }} />
                <span className="text-[11px] text-[#ddefd4] truncate">{selSec.name}</span>
              </div>
            )}
          </div>

          {/* Section palette */}
          <div className="p-3 flex-1 min-h-0">
            <div className="flex items-center justify-between mb-2">
              <p className={lbl} style={{ marginBottom: 0 }}>Sections</p>
              <button onClick={() => { setSecForm({}); setModal({ type: "addSection" }); }}
                className="text-[#7ab648] hover:text-[#9ed460] transition-colors"><Plus size={12} /></button>
            </div>
            <div className="flex flex-col gap-0.5 mt-2">
              {sections.map(sec => {
                const cells = cellCounts[sec.id] ?? 0;
                return (
                  <button key={sec.id}
                    onClick={() => { setSelectedSecId(sec.id); setActiveTool("draw"); }}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-left w-full transition-colors group ${
                      selectedSecId === sec.id && activeTool === "draw"
                        ? "bg-[#1e3d18] border border-[rgba(122,182,72,0.28)]"
                        : "hover:bg-[#1a2d16]"
                    }`}>
                    {/* icon on colour background */}
                    <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 text-xs"
                      style={{ backgroundColor: sec.color + "33", border: `1px solid ${sec.color}55` }}>
                      <span style={{ fontSize: 13 }}>{TYPE_CFG[sec.type]?.icon ?? "?"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-[#b8d4ac] truncate leading-tight">{sec.name}</p>
                      {cells > 0 && (
                        <p className="text-[10px] font-mono text-[#4a6a40] leading-tight">{cellsToAcres(cells)} ac</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Land allocation */}
          <div className="p-3 border-t border-[rgba(122,182,72,0.08)]">
            <p className={lbl}>Land Use · {cellsToAcres(totalFilled)} ac</p>

            {/* stacked bar */}
            <div className="flex h-3 rounded overflow-hidden bg-[#0a1809] mb-2">
              {landUse.map(({ sec, cells }) => (
                <div key={sec.id}
                  style={{ width: `${(cells / totalCells) * 100}%`, backgroundColor: sec.color, flexShrink: 0 }}
                  title={`${sec.name}: ${cellsToAcres(cells)} ac`}
                />
              ))}
              {/* unassigned */}
              {totalFilled < totalCells && (
                <div style={{ flex: 1, backgroundColor: EMPTY_COLOR }} />
              )}
            </div>

            {/* per-section rows */}
            <div className="flex flex-col gap-1">
              {landUse.slice(0, 6).map(({ sec, cells }) => {
                const pct = totalCells > 0 ? ((cells / totalCells) * 100).toFixed(1) : "0";
                return (
                  <div key={sec.id} className="flex items-center gap-1.5">
                    <span style={{ fontSize: 11 }}>{TYPE_CFG[sec.type]?.icon ?? "?"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#6a8f5e] truncate">{sec.name}</span>
                        <span className="text-[10px] font-mono text-[#b8d4ac] ml-1">{cellsToAcres(cells)}ac</span>
                      </div>
                      <div className="h-1 rounded bg-[#1a2d16] mt-0.5 overflow-hidden">
                        <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: sec.color + "cc" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {landUse.length > 6 && (
                <p className="text-[10px] text-[#4a6a40] text-center">+{landUse.length - 6} more</p>
              )}
              {totalFilled < totalCells && (
                <div className="flex items-center gap-1.5">
                  <span style={{ fontSize: 11 }}>⬜</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#4a6a40]">Unassigned</span>
                      <span className="text-[10px] font-mono text-[#4a6a40]">{cellsToAcres(totalCells - totalFilled)}ac</span>
                    </div>
                    <div className="h-1 rounded bg-[#1a2d16] mt-0.5 overflow-hidden">
                      <div className="h-full rounded bg-[#2a3a28]"
                        style={{ width: `${((totalCells - totalFilled) / totalCells) * 100}%` }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Map panel ── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">

          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-[rgba(122,182,72,0.1)] bg-[#0e1e0c] flex-shrink-0 flex-wrap gap-y-1.5">
            {/* Zoom */}
            <div className="flex items-center gap-1">
              <button onClick={() => setZoomIdx(i => Math.max(0, i - 1))} disabled={zoomIdx === 0}
                className="p-1.5 rounded bg-[#1a2d16] text-[#6a8f5e] hover:text-[#ddefd4] disabled:opacity-30 transition-colors">
                <ZoomOut size={13} />
              </button>
              <span className="text-[11px] font-mono text-[#6a8f5e] w-20 text-center select-none">
                {cellSize}px · {CELL_M}m/cell
              </span>
              <button onClick={() => setZoomIdx(i => Math.min(ZOOM_SIZES.length - 1, i + 1))} disabled={zoomIdx === ZOOM_SIZES.length - 1}
                className="p-1.5 rounded bg-[#1a2d16] text-[#6a8f5e] hover:text-[#ddefd4] disabled:opacity-30 transition-colors">
                <ZoomIn size={13} />
              </button>
            </div>

            <div className="h-3.5 w-px bg-[rgba(122,182,72,0.2)]" />

            {/* Resize farm toggle */}
            <button onClick={() => { setShowResize(v => !v); setPendingW(farmW); setPendingH(farmH); }}
              className={`flex items-center gap-1.5 text-[11px] font-mono transition-colors ${
                showResize ? "text-[#d4a843]" : "text-[#6a8f5e] hover:text-[#ddefd4]"
              }`}>
              <Maximize2 size={12} />
              {farmW}m × {farmH}m · {cellsToAcres(totalCells)} ac
              {showResize ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>

            {showResize && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Width */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[#4a6a40] font-mono">W</span>
                  <button onClick={() => setPendingW(v => Math.max(50, v - 50))}
                    className="w-5 h-5 rounded bg-[#1a2d16] text-[#6a8f5e] hover:text-[#ddefd4] text-xs flex items-center justify-center">−</button>
                  <input type="number" className="w-14 bg-[#1a2d16] border border-[rgba(122,182,72,0.2)] rounded px-1.5 py-0.5 text-[11px] font-mono text-[#ddefd4] text-center focus:outline-none"
                    value={pendingW} onChange={e => setPendingW(Number(e.target.value))} />
                  <button onClick={() => setPendingW(v => v + 50)}
                    className="w-5 h-5 rounded bg-[#1a2d16] text-[#6a8f5e] hover:text-[#ddefd4] text-xs flex items-center justify-center">+</button>
                </div>
                <span className="text-[#4a6a40] text-[10px]">×</span>
                {/* Height */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[#4a6a40] font-mono">H</span>
                  <button onClick={() => setPendingH(v => Math.max(50, v - 50))}
                    className="w-5 h-5 rounded bg-[#1a2d16] text-[#6a8f5e] hover:text-[#ddefd4] text-xs flex items-center justify-center">−</button>
                  <input type="number" className="w-14 bg-[#1a2d16] border border-[rgba(122,182,72,0.2)] rounded px-1.5 py-0.5 text-[11px] font-mono text-[#ddefd4] text-center focus:outline-none"
                    value={pendingH} onChange={e => setPendingH(Number(e.target.value))} />
                  <button onClick={() => setPendingH(v => v + 50)}
                    className="w-5 h-5 rounded bg-[#1a2d16] text-[#6a8f5e] hover:text-[#ddefd4] text-xs flex items-center justify-center">+</button>
                </div>
                <span className="text-[10px] font-mono text-[#4a6a40]">m</span>
                <button onClick={applyResize}
                  className="px-2.5 py-1 rounded bg-[#7ab648] text-[#0a1809] text-[11px] font-medium hover:bg-[#9ed460] transition-colors">
                  Apply
                </button>
                {willShrink && (
                  <span className="text-[10px] text-[#d4a843] flex items-center gap-1">
                    <AlertTriangle size={10} /> Edge cells will be cleared
                  </span>
                )}
              </div>
            )}

            <div className="ml-auto text-[11px] font-mono text-[#6a8f5e]">
              {hoveredCell
                ? `${hSec ? hSec.name : "Empty"} · ${hoveredCell.c * CELL_M}m E, ${hoveredCell.r * CELL_M}m N`
                : `${cellsToAcres(totalFilled)} / ${cellsToAcres(totalCells)} ac used · hover to inspect`}
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-auto p-4 bg-[#081508]"
            style={{ cursor: activeTool === "draw" ? "crosshair" : "cell" }}>
            <canvas ref={canvasRef}
              style={{ display: "block", imageRendering: "pixelated", userSelect: "none" }}
              onMouseDown={onMouseDown} onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}    onMouseLeave={onMouseLeave}
            />
          </div>

          {/* Scale bar */}
          <div className="px-4 py-2 border-t border-[rgba(122,182,72,0.08)] bg-[#0e1e0c] flex items-center gap-6 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-2 w-8 border border-[rgba(255,255,255,0.2)]"
                    style={{ backgroundColor: i % 2 === 0 ? "rgba(255,255,255,0.3)" : "transparent" }} />
                ))}
              </div>
              <span className="text-[10px] font-mono text-[#4a6a40]">0 ——— {CELL_M * 40}m</span>
            </div>
            <span className="text-[10px] font-mono text-[#4a6a40]">
              Grid: {gridCols}×{gridRows} cells · {CELL_M}m/cell · {farmW}m × {farmH}m total
            </span>
          </div>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ── SECTIONS TAB ─────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  const renderSections = () => (
    <div className="p-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl text-[#ddefd4]">Farm Sections</h2>
          <p className="text-sm text-[#6a8f5e] mt-0.5">
            {sections.length} sections · {cellsToAcres(totalFilled)} / {cellsToAcres(totalCells)} acres mapped
          </p>
        </div>
        <button onClick={() => { setSecForm({}); setModal({ type: "addSection" }); }}
          className="flex items-center gap-2 px-3 py-2 rounded bg-[#7ab648] text-[#0a1809] text-sm font-medium hover:bg-[#9ed460] transition-colors">
          <Plus size={14} />New Section
        </button>
      </div>

      {/* land allocation summary bar */}
      <div className="rounded-xl border border-[rgba(122,182,72,0.1)] bg-[#152a12] p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[#ddefd4]">Land Allocation</h3>
          <span className="text-xs font-mono text-[#6a8f5e]">
            {cellsToAcres(totalFilled)} ac used of {cellsToAcres(totalCells)} ac total ({((totalFilled / totalCells) * 100).toFixed(0)}%)
          </span>
        </div>
        <div className="flex h-5 rounded overflow-hidden bg-[#0a1809] mb-3">
          {landUse.map(({ sec, cells }) => (
            <div key={sec.id}
              className="flex items-center justify-center overflow-hidden"
              style={{ width: `${(cells / totalCells) * 100}%`, backgroundColor: sec.color, flexShrink: 0 }}
              title={`${sec.name}: ${cellsToAcres(cells)} ac`}>
              {(cells / totalCells) > 0.06 && (
                <span style={{ fontSize: 11 }}>{TYPE_CFG[sec.type]?.icon}</span>
              )}
            </div>
          ))}
          {totalFilled < totalCells && (
            <div style={{ flex: 1, backgroundColor: EMPTY_COLOR }} />
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {landUse.map(({ sec, cells }) => (
            <div key={sec.id} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: sec.color }} />
              <span className="text-[11px] text-[#6a8f5e] truncate flex-1">{sec.name}</span>
              <span className="text-[11px] font-mono text-[#b8d4ac] flex-shrink-0">{cellsToAcres(cells)} ac</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))" }}>
        {sections.map(sec => {
          const cells    = cellCounts[sec.id] ?? 0;
          const secTasks = tasks.filter(t => t.sectionId === sec.id && !t.done);
          const secInc   = finances.filter(f => f.sectionId === sec.id && f.type === "income").reduce((s, f) => s + f.amount, 0);
          const secExp   = finances.filter(f => f.sectionId === sec.id && f.type === "expense").reduce((s, f) => s + f.amount, 0);
          const cfg      = TYPE_CFG[sec.type];

          return (
            <div key={sec.id}
              className="rounded-xl border border-[rgba(122,182,72,0.12)] bg-[#152a12] p-4 hover:border-[rgba(122,182,72,0.25)] transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  {/* Icon badge */}
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-xl"
                    style={{ backgroundColor: sec.color + "22", border: `1px solid ${sec.color}44` }}>
                    {cfg?.icon ?? "?"}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-[#ddefd4] leading-tight">{sec.name}</h3>
                    <p className="text-xs text-[#6a8f5e] mt-0.5">{cfg?.label ?? sec.type}</p>
                    {cells > 0 && (
                      <p className="text-xs font-mono text-[#7ab648] mt-0.5">
                        {cellsToAcres(cells)} ac · {cellsToM2(cells)} m²
                        <span className="text-[#4a6a40] ml-1">
                          ({((cells / totalCells) * 100).toFixed(1)}% of farm)
                        </span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 ml-2">
                  <button onClick={() => { setSecForm({ ...sec }); setModal({ type: "editSection", id: sec.id }); }}
                    className="p-1 text-[#4a6a40] hover:text-[#7ab648] transition-colors"><Pencil size={13} /></button>
                  <button onClick={() => deleteSection(sec.id)}
                    className="p-1 text-[#4a6a40] hover:text-[#d94832] transition-colors"><Trash2 size={13} /></button>
                </div>
              </div>

              {sec.cropDetails && (
                <p className="text-xs text-[#b8d4ac] mb-3 leading-relaxed">{sec.cropDetails}</p>
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mb-3">
                {sec.plantDate    && (<><span className="text-[#4a6a40]">Planted</span><span className="text-[#b8d4ac] font-mono">{fmtDate(sec.plantDate)}</span></>)}
                {sec.harvestDate  && (<><span className="text-[#4a6a40]">Harvest</span><span className="text-[#b8d4ac] font-mono">{sec.harvestDate}</span></>)}
                {sec.waterSchedule && (<><span className="text-[#4a6a40] flex items-center gap-1"><Droplets size={10} />Water</span><span className="text-[#b8d4ac]">{sec.waterSchedule}</span></>)}
              </div>
              {sec.notes && <p className="text-[11px] text-[#4a7a40] italic mb-3">{sec.notes}</p>}
              {(secInc > 0 || secExp > 0) && (
                <div className="flex gap-4 pt-3 border-t border-[rgba(122,182,72,0.08)] text-xs font-mono">
                  <span className="text-[#7ab648]">+{fmtKES(secInc)}</span>
                  <span className="text-[#d94832]">−{fmtKES(secExp)}</span>
                </div>
              )}
              {secTasks.length > 0 && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#d4a843]">
                  <Clock size={11} />{secTasks.length} pending task{secTasks.length !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // ── ACTIVITIES TAB ────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  const renderActivities = () => {
    const base = tasks.filter(t =>
      taskFilter === "pending" ? !t.done : taskFilter === "done" ? t.done : true
    ).sort((a, b) => { if (a.done !== b.done) return a.done ? 1 : -1; return a.dueDate.localeCompare(b.dueDate); });

    const overdue  = base.filter(t => !t.done && t.dueDate < TODAY);
    const dueToday = base.filter(t => !t.done && t.dueDate === TODAY);
    const upcoming = base.filter(t => !t.done && t.dueDate > TODAY);
    const done     = base.filter(t => t.done);

    const TaskRow = ({ t }: { t: Task }) => {
      const sec = sectionMap.get(t.sectionId);
      const ov  = isOverdue(t);
      return (
        <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors group ${
          t.done ? "bg-[#0e1a0c] border-[rgba(122,182,72,0.05)] opacity-55"
          : ov    ? "bg-[#1f1108] border-[rgba(217,72,50,0.18)] hover:border-[rgba(217,72,50,0.35)]"
                  : "bg-[#152a12] border-[rgba(122,182,72,0.1)] hover:border-[rgba(122,182,72,0.25)]"
        }`}>
          <button onClick={() => toggleTask(t.id)}
            className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-all ${
              t.done ? "bg-[#7ab648] border-[#7ab648]" : "border-[rgba(122,182,72,0.4)] hover:border-[#7ab648]"
            }`}>
            {t.done && <Check size={10} className="text-[#0a1809]" />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <span className={`text-sm leading-snug flex-1 ${t.done ? "line-through text-[#4a6a40]" : "text-[#ddefd4]"}`}>{t.title}</span>
              <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: priorityColor(t.priority) }} />
            </div>
            <div className="flex items-center flex-wrap gap-2 mt-1.5">
              {sec && (
                <span className="text-[11px] px-1.5 py-0.5 rounded font-mono flex items-center gap-1"
                  style={{ backgroundColor: sec.color + "20", color: sec.color }}>
                  <span>{TYPE_CFG[sec.type]?.icon}</span>{sec.name}
                </span>
              )}
              <span className={`text-[11px] font-mono flex items-center gap-1 ${ov ? "text-[#d94832]" : t.done ? "text-[#4a6a40]" : "text-[#6a8f5e]"}`}>
                <Calendar size={10} />
                {t.done ? `Done ${fmtDate(t.completedDate)}` : fmtDate(t.dueDate)}
                {ov && " · overdue"}
              </span>
              {t.estimatedCost > 0 && <span className="text-[11px] font-mono text-[#6a8f5e]">{fmtKES(t.estimatedCost)}</span>}
            </div>
            {t.notes && <p className="text-[11px] text-[#4a7a40] mt-1 italic">{t.notes}</p>}
          </div>
          <button onClick={() => deleteTask(t.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[#4a6a40] hover:text-[#d94832] flex-shrink-0">
            <Trash2 size={13} />
          </button>
        </div>
      );
    };

    const Group = ({ label, items, color }: { label: string; items: Task[]; color: string }) => {
      if (!items.length) return null;
      return (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color }}>{label}</span>
            <span className="text-[10px] font-mono text-[#4a6a40]">{items.length}</span>
          </div>
          <div className="flex flex-col gap-2">{items.map(t => <TaskRow key={t.id} t={t} />)}</div>
        </div>
      );
    };

    return (
      <div className="p-6 overflow-y-auto h-full">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl text-[#ddefd4]">Farm Activities</h2>
            <p className="text-sm text-[#6a8f5e] mt-0.5">
              {pendingTasks.length} pending · est. {fmtKES(pendingTasks.reduce((s, t) => s + t.estimatedCost, 0))} cost
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded overflow-hidden border border-[rgba(122,182,72,0.18)]">
              {(["all","pending","done"] as const).map(f => (
                <button key={f} onClick={() => setTaskFilter(f)}
                  className={`px-3 py-1.5 text-[11px] capitalize transition-colors ${
                    taskFilter === f ? "bg-[#7ab648] text-[#0a1809]" : "bg-[#152a12] text-[#6a8f5e] hover:bg-[#1e3818]"
                  }`}>{f}</button>
              ))}
            </div>
            <button onClick={() => { setTaskForm({ dueDate: TODAY, priority: "medium" }); setModal({ type: "addTask" }); }}
              className="flex items-center gap-2 px-3 py-2 rounded bg-[#7ab648] text-[#0a1809] text-sm font-medium hover:bg-[#9ed460] transition-colors">
              <Plus size={14} />Add Task
            </button>
          </div>
        </div>
        {todayTasks.length > 0 && taskFilter !== "done" && (
          <div className="mb-5 p-3 rounded-lg bg-[#1f1a0a] border border-[rgba(212,168,67,0.25)] flex items-center gap-2">
            <AlertTriangle size={14} className="text-[#d4a843] flex-shrink-0" />
            <span className="text-sm text-[#d4a843]">{todayTasks.length} task{todayTasks.length !== 1 ? "s" : ""} due today</span>
          </div>
        )}
        <div className="max-w-3xl">
          {taskFilter !== "done" && (
            <><Group label="Overdue" items={overdue} color="#d94832" /><Group label="Due Today" items={dueToday} color="#e0a020" /><Group label="Upcoming" items={upcoming} color="#7ab648" /></>
          )}
          {taskFilter !== "pending" && <Group label="Completed" items={done} color="#4a6a40" />}
          {base.length === 0 && (
            <div className="text-center py-16 text-[#4a6a40]">
              <CheckSquare2 size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No activities found</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ── FINANCE TAB ───────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  const renderFinance = () => {
    const net      = totalIncome - totalExpense;
    const roi      = totalExpense > 0 ? ((net / totalExpense) * 100).toFixed(1) : "0";
    const filtered = [...finances].sort((a, b) => b.date.localeCompare(a.date)).filter(f => finFilter === "all" || f.type === finFilter);

    const secBreakdown = sections
      .map(s => ({
        sec: s,
        income:  finances.filter(f => f.sectionId === s.id && f.type === "income").reduce((a, f) => a + f.amount, 0),
        expense: finances.filter(f => f.sectionId === s.id && f.type === "expense").reduce((a, f) => a + f.amount, 0),
      }))
      .filter(x => x.income > 0 || x.expense > 0)
      .sort((a, b) => (b.income - b.expense) - (a.income - a.expense));

    const ttStyle = {
      contentStyle: { backgroundColor: "#0e1e0c", border: "1px solid rgba(122,182,72,0.18)", borderRadius: 6, fontSize: 12 },
      labelStyle: { color: "#ddefd4" },
    };

    return (
      <div className="p-6 overflow-y-auto h-full">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl text-[#ddefd4]">Farm Finance</h2>
            <p className="text-sm text-[#6a8f5e] mt-0.5">Year-to-date · {finances.length} transactions</p>
          </div>
          <button onClick={() => { setFinForm({ date: TODAY, type: "expense" }); setModal({ type: "addFinance" }); }}
            className="flex items-center gap-2 px-3 py-2 rounded bg-[#7ab648] text-[#0a1809] text-sm font-medium hover:bg-[#9ed460] transition-colors">
            <Plus size={14} />Add Record
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5 lg:grid-cols-4">
          {[
            { label: "Total Income",    value: fmtKES(totalIncome),      sub: "All crop sales",         color: "#7ab648", up: true },
            { label: "Total Expenses",  value: fmtKES(totalExpense),     sub: "All input costs",        color: "#d94832", up: false },
            { label: "Net Profit",      value: fmtKES(net),              sub: net >= 0 ? "In profit" : "At loss", color: net >= 0 ? "#7ab648" : "#d94832", up: net >= 0 },
            { label: "Projected Annual",value: fmtKES(projectedAnnual),  sub: `ROI ${roi}% · 3-mo avg`, color: "#d4a843", up: true },
          ].map(({ label, value, sub, color, up }) => (
            <div key={label} className="rounded-xl border border-[rgba(122,182,72,0.1)] bg-[#152a12] p-4">
              <div className="flex items-start justify-between mb-2">
                <span className="text-[11px] text-[#6a8f5e]">{label}</span>
                {up ? <ArrowUpRight size={14} style={{ color }} /> : <ArrowDownRight size={14} style={{ color }} />}
              </div>
              <p className="text-base font-mono font-medium" style={{ color }}>{value}</p>
              <p className="text-[11px] text-[#4a6a40] mt-1">{sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 mb-5 lg:grid-cols-2">
          <div className="rounded-xl border border-[rgba(122,182,72,0.1)] bg-[#152a12] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-[#ddefd4]">Monthly Income vs Expenses</h3>
              <div className="flex gap-3 text-[10px] text-[#6a8f5e]">
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-[#7ab648]" />Income</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-[#d4a843]" />Expenses</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthlyData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barGap={2}>
                <CartesianGrid key="grid" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis key="xaxis" dataKey="name" tick={{ fill: "#6a8f5e", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis key="yaxis" tick={{ fill: "#6a8f5e", fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip key="tooltip" {...ttStyle}
                  formatter={(val: number, nm: string) => [`KES ${val.toLocaleString()}`, nm === "income" ? "Income" : "Expenses"]} />
                <Bar key="bar-income"  name="Income"   dataKey="income"  fill="#7ab648" radius={[3, 3, 0, 0]} maxBarSize={36} />
                <Bar key="bar-expense" name="Expenses" dataKey="expense" fill="#d4a843" radius={[3, 3, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl border border-[rgba(122,182,72,0.1)] bg-[#152a12] p-4">
            <h3 className="text-sm font-medium text-[#ddefd4] mb-3">Cumulative Profit</h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={cumulativeData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="farmProfitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop key="stop-top"    offset="5%"  stopColor="#7ab648" stopOpacity={0.3} />
                    <stop key="stop-bottom" offset="95%" stopColor="#7ab648" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid key="grid" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis key="xaxis" dataKey="name" tick={{ fill: "#6a8f5e", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis key="yaxis" tick={{ fill: "#6a8f5e", fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip key="tooltip" {...ttStyle}
                  formatter={(val: number) => [`KES ${val.toLocaleString()}`, "Cumulative Profit"]} />
                <Area key="area-profit" name="Cumulative Profit" type="monotone" dataKey="cumulative"
                  stroke="#7ab648" strokeWidth={2} fill="url(#farmProfitGrad)" dot={{ fill: "#7ab648", r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {secBreakdown.length > 0 && (
          <div className="rounded-xl border border-[rgba(122,182,72,0.1)] bg-[#152a12] p-4 mb-5">
            <h3 className="text-sm font-medium text-[#ddefd4] mb-3">By Section</h3>
            <div className="flex flex-col gap-2">
              {secBreakdown.map(({ sec, income, expense }) => {
                const profit = income - expense;
                const barW   = income > 0 ? Math.round((income / totalIncome) * 100) : 0;
                return (
                  <div key={sec.id} className="flex items-center gap-3">
                    <span style={{ fontSize: 14 }}>{TYPE_CFG[sec.type]?.icon ?? ""}</span>
                    <span className="text-xs text-[#b8d4ac] w-32 flex-shrink-0 truncate">{sec.name}</span>
                    <div className="flex-1 h-1.5 rounded bg-[#1a2d16] overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${barW}%`, backgroundColor: sec.color + "99" }} />
                    </div>
                    <span className="text-xs font-mono text-[#7ab648] w-24 text-right">{fmtKES(income)}</span>
                    <span className={`text-xs font-mono w-24 text-right ${profit >= 0 ? "text-[#7ab648]" : "text-[#d94832]"}`}>
                      {profit >= 0 ? "+" : "−"}{fmtKES(Math.abs(profit))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-[rgba(122,182,72,0.1)] bg-[#152a12]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(122,182,72,0.08)]">
            <h3 className="text-sm font-medium text-[#ddefd4]">Transactions</h3>
            <div className="flex rounded overflow-hidden border border-[rgba(122,182,72,0.15)]">
              {(["all","income","expense"] as const).map(f => (
                <button key={f} onClick={() => setFinFilter(f)}
                  className={`px-2.5 py-1 text-[11px] capitalize transition-colors ${
                    finFilter === f ? "bg-[#7ab648] text-[#0a1809]" : "bg-transparent text-[#6a8f5e] hover:bg-[#1e3818]"
                  }`}>{f}</button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-[rgba(122,182,72,0.05)]">
            {filtered.slice(0, 20).map(f => {
              const sec = sectionMap.get(f.sectionId);
              return (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#0e1e0c] transition-colors group">
                  <div className={`w-0.5 h-7 rounded-full flex-shrink-0 ${f.type === "income" ? "bg-[#7ab648]" : "bg-[#d94832]"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#ddefd4] truncate">{f.description}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a2d16] text-[#6a8f5e] flex-shrink-0">{f.category}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-[#4a6a40] font-mono">
                      <span>{fmtDate(f.date)}</span>
                      {sec && <span className="flex items-center gap-1" style={{ color: sec.color + "99" }}><span>{TYPE_CFG[sec.type]?.icon}</span>{sec.name}</span>}
                    </div>
                  </div>
                  <span className={`text-sm font-mono font-medium flex-shrink-0 ${f.type === "income" ? "text-[#7ab648]" : "text-[#d94832]"}`}>
                    {f.type === "income" ? "+" : "−"} KES {f.amount.toLocaleString()}
                  </span>
                  <button onClick={() => deleteFinance(f.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[#4a6a40] hover:text-[#d94832]">
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ── MODALS ────────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  const renderModal = () => {
    if (!modal) return null;
    const Wrap = ({ title, onSave, children }: { title: string; onSave: () => void; children: React.ReactNode }) => (
      <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
        <div className="bg-[#152a12] border border-[rgba(122,182,72,0.2)] rounded-xl w-full max-w-md max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(122,182,72,0.1)] flex-shrink-0">
            <h3 className="text-[#ddefd4]">{title}</h3>
            <button onClick={() => setModal(null)} className="text-[#4a6a40] hover:text-[#ddefd4] transition-colors"><X size={16} /></button>
          </div>
          <div className="p-5 flex flex-col gap-4 overflow-y-auto flex-1">{children}</div>
          <div className="flex justify-end gap-2 px-5 pb-5 flex-shrink-0">
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-[#6a8f5e] hover:text-[#ddefd4] transition-colors">Cancel</button>
            <button onClick={onSave} className="px-4 py-2 text-sm bg-[#7ab648] text-[#0a1809] rounded font-medium hover:bg-[#9ed460] transition-colors">Save</button>
          </div>
        </div>
      </div>
    );
    const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
      <div><label className={lbl}>{label}</label>{children}</div>
    );

    if (modal.type === "addSection" || modal.type === "editSection") {
      return (
        <Wrap title={modal.type === "addSection" ? "New Section" : "Edit Section"} onSave={saveSection}>
          <F label="Section Name">
            <input className={inp} placeholder="e.g. South Tomatoes" value={secForm.name ?? ""}
              onChange={e => setSecForm(p => ({ ...p, name: e.target.value }))} />
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Type">
              <select className={inp} value={secForm.type ?? "garden"}
                onChange={e => { const t = e.target.value as SectionType; setSecForm(p => ({ ...p, type: t, color: TYPE_CFG[t]?.color ?? p.color })); }}>
                {TYPE_KEYS.map(k => (
                  <option key={k} value={k}>{TYPE_CFG[k].icon} {TYPE_CFG[k].label}</option>
                ))}
              </select>
            </F>
            <F label="Color">
              <div className="flex flex-wrap gap-1.5 mt-1">
                {PRESET_COLORS.map(c => (
                  <button key={c} onClick={() => setSecForm(p => ({ ...p, color: c }))}
                    className="w-5 h-5 rounded transition-transform hover:scale-110 flex-shrink-0"
                    style={{ backgroundColor: c, outline: secForm.color === c ? "2px solid #ddefd4" : "none", outlineOffset: 1 }} />
                ))}
              </div>
            </F>
          </div>
          <F label="Crop / Use Details">
            <input className={inp} placeholder="Variety, spacing, intended use…" value={secForm.cropDetails ?? ""}
              onChange={e => setSecForm(p => ({ ...p, cropDetails: e.target.value }))} />
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Plant Date"><input type="date" className={inp} value={secForm.plantDate ?? ""}
              onChange={e => setSecForm(p => ({ ...p, plantDate: e.target.value }))} /></F>
            <F label="Harvest / Review Date"><input type="date" className={inp} value={secForm.harvestDate ?? ""}
              onChange={e => setSecForm(p => ({ ...p, harvestDate: e.target.value }))} /></F>
          </div>
          <F label="Water Schedule">
            <input className={inp} placeholder="e.g. Daily drip, twice weekly" value={secForm.waterSchedule ?? ""}
              onChange={e => setSecForm(p => ({ ...p, waterSchedule: e.target.value }))} />
          </F>
          <F label="Notes">
            <textarea className={inp + " resize-none h-16"} placeholder="Soil type, spacing notes, risks…"
              value={secForm.notes ?? ""} onChange={e => setSecForm(p => ({ ...p, notes: e.target.value }))} />
          </F>
        </Wrap>
      );
    }
    if (modal.type === "addTask") {
      return (
        <Wrap title="New Activity" onSave={saveTask}>
          <F label="Activity Description">
            <input className={inp} placeholder="What needs to be done?" value={taskForm.title ?? ""}
              onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} />
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Section">
              <select className={inp} value={taskForm.sectionId ?? ""} onChange={e => setTaskForm(p => ({ ...p, sectionId: e.target.value }))}>
                <option value="">— Farm-wide —</option>
                {sections.map(s => <option key={s.id} value={s.id}>{TYPE_CFG[s.type]?.icon} {s.name}</option>)}
              </select>
            </F>
            <F label="Priority">
              <select className={inp} value={taskForm.priority ?? "medium"} onChange={e => setTaskForm(p => ({ ...p, priority: e.target.value as Priority }))}>
                <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
              </select>
            </F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Due Date"><input type="date" className={inp} value={taskForm.dueDate ?? TODAY}
              onChange={e => setTaskForm(p => ({ ...p, dueDate: e.target.value }))} /></F>
            <F label="Estimated Cost (KES)"><input type="number" className={inp} placeholder="0"
              value={taskForm.estimatedCost ?? ""} onChange={e => setTaskForm(p => ({ ...p, estimatedCost: Number(e.target.value) }))} /></F>
          </div>
          <F label="Notes">
            <textarea className={inp + " resize-none h-16"} placeholder="Instructions, reminders…"
              value={taskForm.notes ?? ""} onChange={e => setTaskForm(p => ({ ...p, notes: e.target.value }))} />
          </F>
        </Wrap>
      );
    }
    if (modal.type === "addFinance") {
      return (
        <Wrap title="Add Transaction" onSave={saveFinance}>
          <div className="grid grid-cols-2 gap-3">
            <F label="Type">
              <select className={inp} value={finForm.type ?? "expense"} onChange={e => setFinForm(p => ({ ...p, type: e.target.value as FinanceType }))}>
                <option value="income">Income</option><option value="expense">Expense</option>
              </select>
            </F>
            <F label="Date"><input type="date" className={inp} value={finForm.date ?? TODAY}
              onChange={e => setFinForm(p => ({ ...p, date: e.target.value }))} /></F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Category"><input className={inp} placeholder="Crop Sale, Labor, Seeds…" value={finForm.category ?? ""}
              onChange={e => setFinForm(p => ({ ...p, category: e.target.value }))} /></F>
            <F label="Amount (KES)"><input type="number" className={inp} placeholder="0" value={finForm.amount ?? ""}
              onChange={e => setFinForm(p => ({ ...p, amount: Number(e.target.value) }))} /></F>
          </div>
          <F label="Description"><input className={inp} placeholder="Brief description of transaction" value={finForm.description ?? ""}
            onChange={e => setFinForm(p => ({ ...p, description: e.target.value }))} /></F>
          <F label="Section (optional)">
            <select className={inp} value={finForm.sectionId ?? ""} onChange={e => setFinForm(p => ({ ...p, sectionId: e.target.value }))}>
              <option value="">— Farm-wide —</option>
              {sections.map(s => <option key={s.id} value={s.id}>{TYPE_CFG[s.type]?.icon} {s.name}</option>)}
            </select>
          </F>
        </Wrap>
      );
    }
    return null;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ── MAIN RENDER ───────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="w-52 flex-shrink-0 bg-[#0d1e0b] border-r border-[rgba(122,182,72,0.1)] flex flex-col">
        <div className="px-4 py-4 border-b border-[rgba(122,182,72,0.08)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#7ab648] flex items-center justify-center flex-shrink-0">
              <Leaf size={15} className="text-[#0a1809]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-[#ddefd4] truncate leading-tight">Greenfield Farm</p>
              <p className="text-[10px] font-mono text-[#4a6a40]">{cellsToAcres(totalCells)} ac · Managed</p>
            </div>
          </div>
        </div>
        <nav className="px-2 py-3 flex flex-col gap-0.5">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors w-full ${
                tab === id ? "bg-[#1e3818] text-[#7ab648]" : "text-[#6a8f5e] hover:bg-[#152a12] hover:text-[#b8d4ac]"
              }`}>
              <Icon size={15} />{label}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-[rgba(122,182,72,0.08)] px-4 py-4">
          <p className="text-[10px] font-mono text-[#3a5a32] uppercase tracking-widest mb-3">Quick Stats</p>
          {[
            { label: "Farm size",      value: `${cellsToAcres(totalCells)} ac` },
            { label: "Mapped",         value: `${cellsToAcres(totalFilled)} ac` },
            { label: "Sections",       value: sections.length.toString() },
            { label: "Pending tasks",  value: pendingTasks.length.toString(),    warn: pendingTasks.length > 5 },
            { label: "Due today",      value: todayTasks.length.toString(),      warn: todayTasks.length > 0 },
            { label: "Net P&L (YTD)", value: `KES ${((totalIncome - totalExpense) / 1000).toFixed(0)}k`, warn: totalIncome < totalExpense },
          ].map(({ label, value, warn }) => (
            <div key={label} className="flex items-center justify-between py-1">
              <span className="text-[11px] text-[#4a6a40]">{label}</span>
              <span className={`text-[11px] font-mono ${warn ? "text-[#d4a843]" : "text-[#b8d4ac]"}`}>{value}</span>
            </div>
          ))}
        </div>
        <div className="px-4 pb-4">
          <p className="text-[10px] font-mono text-[#3a5a32]">
            {new Date().toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        <header className="flex-shrink-0 h-11 px-5 border-b border-[rgba(122,182,72,0.1)] bg-[#0d1e0b] flex items-center gap-2">
          {(() => { const n = NAV.find(x => x.id === tab)!; const Icon = n.icon; return <><Icon size={15} className="text-[#7ab648]" /><span className="text-sm text-[#ddefd4]">{n.label}</span></>; })()}
        </header>
        <div className="flex-1 overflow-hidden">
          {tab === "map"        && renderMap()}
          {tab === "sections"   && renderSections()}
          {tab === "activities" && renderActivities()}
          {tab === "finance"    && renderFinance()}
        </div>
      </main>

      {renderModal()}
    </div>
  );
}
