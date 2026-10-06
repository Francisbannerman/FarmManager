import { useEffect, useMemo, useRef, useState } from "react";
import { Eraser, Maximize2, Pencil, Plus, ZoomIn, ZoomOut, Leaf } from "lucide-react";
import type { FarmData } from "./useFarmData";
import { EMPTY_COLOR, fmtAcres, iconFor } from "../format";
import { labelCls } from "../ui";

type Tool = "draw" | "erase";

const ZOOM_SIZES = [7, 12, 19, 30, 48];
const MAX_CANVAS_PX = 16000; // stay under browser canvas size limits

interface Props {
  data: FarmData;
  selectedSecId: string | null;
  onSelectSection: (id: string) => void;
  onAddSection: () => void;
  onFarmSettings: () => void;
}

export function MapTab({ data, selectedSecId, onSelectSection, onAddSection, onFarmSettings }: Props) {
  const { farm, sections, dims, cellsRef, gridVersion, cellCounts, paint, flushPaint, saving } = data;
  const { cols, rows, cellSize: cellM } = dims;

  const [tool, setTool] = useState<Tool>("draw");
  const [zoomIdx, setZoomIdx] = useState(1);
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);

  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastCell = useRef<{ r: number; c: number } | null>(null);

  const zoomLevels = useMemo(() => {
    const allowed = ZOOM_SIZES.filter(z => cols * z <= MAX_CANVAS_PX && rows * z <= MAX_CANVAS_PX);
    return allowed.length ? allowed : [ZOOM_SIZES[0]];
  }, [cols, rows]);
  const zi = Math.min(zoomIdx, zoomLevels.length - 1);
  const px = zoomLevels[zi];

  const sectionMap = useMemo(() => new Map(sections.map(s => [s.id, s])), [sections]);
  const selSec = selectedSecId ? sectionMap.get(selectedSecId) ?? null : null;

  const totalCells = cols * rows;
  const totalFilled = useMemo(() => Object.values(cellCounts).reduce((a, b) => a + b, 0), [cellCounts]);
  const landUse = useMemo(
    () => sections.map(s => ({ sec: s, cells: cellCounts[s.id] ?? 0 })).filter(x => x.cells > 0).sort((a, b) => b.cells - a.cells),
    [sections, cellCounts],
  );

  // ── base canvas: fills, grid, rulers, labels ────────────────────────────────
  useEffect(() => {
    const canvas = baseRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const cw = cols * px;
    const ch = rows * px;
    canvas.width = cw;   // assigning also clears the canvas
    canvas.height = ch;
    const cells = cellsRef.current;

    ctx.fillStyle = EMPTY_COLOR;
    ctx.fillRect(0, 0, cw, ch);

    const centroids = new Map<string, { sumC: number; sumR: number; n: number }>();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const sid = cells[r * cols + c];
        if (!sid) continue;
        ctx.fillStyle = sectionMap.get(sid)?.color ?? "#555";
        ctx.fillRect(c * px, r * px, px, px);
        const cen = centroids.get(sid) ?? { sumC: 0, sumR: 0, n: 0 };
        cen.sumC += c; cen.sumR += r; cen.n++;
        centroids.set(sid, cen);
      }
    }

    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    for (let r = 0; r <= rows; r++) { ctx.moveTo(0, r * px); ctx.lineTo(cw, r * px); }
    for (let c = 0; c <= cols; c++) { ctx.moveTo(c * px, 0); ctx.lineTo(c * px, ch); }
    ctx.stroke();

    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.13)";
    ctx.beginPath();
    for (let r = 0; r <= rows; r += 10) { ctx.moveTo(0, r * px); ctx.lineTo(cw, r * px); }
    for (let c = 0; c <= cols; c += 10) { ctx.moveTo(c * px, 0); ctx.lineTo(c * px, ch); }
    ctx.stroke();

    if (px >= 19) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = `${Math.max(8, Math.floor(px * 0.28))}px 'JetBrains Mono', monospace`;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "center";
      for (let c = 0; c <= cols; c += 10) ctx.fillText(`${c * cellM}m`, c * px, 9);
      ctx.textAlign = "right";
      for (let r = 0; r <= rows; r += 10) ctx.fillText(`${r * cellM}m`, cw - 2, r * px + 10);
    }

    for (const sec of sections) {
      const cen = centroids.get(sec.id);
      if (!cen || cen.n < 2) continue;
      const cx = (cen.sumC / cen.n + 0.5) * px;
      const cy = (cen.sumR / cen.n + 0.5) * px;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (px >= 12) {
        ctx.font = `${Math.min(Math.max(px * 0.9, 10), 28)}px serif`;
        ctx.fillStyle = "#fff";
        ctx.fillText(iconFor(sec.type), cx, cy);
      }
      if (px >= 19) {
        const lineY = cy + Math.min(px * 0.7, 22);
        const nameSz = Math.max(8, Math.min(px * 0.28, 13));
        ctx.font = `600 ${nameSz}px 'Instrument Sans', sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 3;
        ctx.fillText(sec.name, cx, lineY);
        ctx.shadowBlur = 0;
        const acSz = Math.max(7, Math.min(px * 0.22, 11));
        ctx.font = `${acSz}px 'JetBrains Mono', monospace`;
        ctx.fillStyle = "rgba(255,255,255,0.65)";
        ctx.fillText(`${fmtAcres(cen.n, cellM)} ac`, cx, lineY + acSz + 2);
      }
    }
  }, [cols, rows, px, cellM, sections, sectionMap, gridVersion, cellsRef]);

  // ── overlay canvas: hover highlight only (cheap to redraw) ──────────────────
  useEffect(() => {
    const canvas = overlayRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.width = cols * px;
    canvas.height = rows * px;
    if (!hover) return;
    const { r, c } = hover;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(c * px + 0.5, r * px + 0.5, px - 1, px - 1);
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(c * px + 0.5, r * px + 0.5, px - 1, px - 1);
  }, [hover, cols, rows, px]);

  // ── pointer handling (mouse, touch and pen) ─────────────────────────────────
  const cellAt = (e: React.PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) / px);
    const r = Math.floor((e.clientY - rect.top) / px);
    return r >= 0 && r < rows && c >= 0 && c < cols ? { r, c } : null;
  };

  const target = (): string | null | undefined => (tool === "erase" ? null : selectedSecId ?? undefined);

  const paintTo = (cell: { r: number; c: number }) => {
    const value = target();
    if (value === undefined) return;
    const from = lastCell.current ?? cell;
    // Fill the gap between pointer events so fast strokes leave no holes (Bresenham).
    let { r: r0, c: c0 } = from;
    const dr = Math.abs(cell.r - r0), dc = Math.abs(cell.c - c0);
    const sr = r0 < cell.r ? 1 : -1, sc = c0 < cell.c ? 1 : -1;
    let err = dc - dr;
    for (;;) {
      paint(r0, c0, value);
      if (r0 === cell.r && c0 === cell.c) break;
      const e2 = 2 * err;
      if (e2 > -dr) { err -= dr; c0 += sc; }
      if (e2 < dc) { err += dc; r0 += sr; }
    }
    lastCell.current = cell;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const cell = cellAt(e);
    if (!cell) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    lastCell.current = null;
    paintTo(cell);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const cell = cellAt(e);
    setHover(prev => (prev?.r === cell?.r && prev?.c === cell?.c ? prev : cell));
    if (drawing.current && cell) paintTo(cell);
  };
  const endStroke = () => {
    if (!drawing.current) return;
    drawing.current = false;
    lastCell.current = null;
    void flushPaint();
  };

  const hoverSec = hover ? sectionMap.get(cellsRef.current[hover.r * cols + hover.c] ?? "") : null;
  const noSections = sections.length === 0;
  const scaleCells = 10 * px <= 240 ? 10 : 5; // scale bar length, in cells

  return (
    <div className="flex flex-col md:flex-row h-full min-h-0">
      {/* ── Left panel ── */}
      <div className="w-full md:w-48 max-h-52 md:max-h-none flex-shrink-0 bg-[#0e1e0c] border-b md:border-b-0 md:border-r border-[rgba(122,182,72,0.1)] flex flex-col overflow-y-auto">
        <div className="p-3 border-b border-[rgba(122,182,72,0.08)]">
          <p className={labelCls}>Tools</p>
          <div className="flex gap-1.5">
            {([["draw", "Draw", Pencil], ["erase", "Erase", Eraser]] as const).map(([t, label, Icon]) => (
              <button key={t} onClick={() => setTool(t)} aria-pressed={tool === t}
                className={`flex-1 flex flex-col items-center gap-1 py-2 rounded text-[11px] transition-colors ${
                  tool === t ? (t === "draw" ? "bg-[#7ab648] text-[#0a1809]" : "bg-[#d94832] text-white") : "bg-[#1a2d16] text-[#6a8f5e] hover:bg-[#243d20]"
                }`}>
                <Icon size={13} />{label}
              </button>
            ))}
          </div>
          {tool === "draw" && selSec && (
            <div className="mt-2 flex items-center gap-2 p-2 rounded bg-[#1a2d16] border border-[rgba(122,182,72,0.15)]">
              <span className="text-sm leading-none">{iconFor(selSec.type)}</span>
              <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: selSec.color }} />
              <span className="text-[11px] text-[#ddefd4] truncate">{selSec.name}</span>
            </div>
          )}
        </div>

        <div className="p-3 flex-1 min-h-0">
          <div className="flex items-center justify-between mb-2">
            <p className={labelCls} style={{ marginBottom: 0 }}>Sections</p>
            <button onClick={onAddSection} aria-label="New section" className="text-[#7ab648] hover:text-[#9ed460] transition-colors"><Plus size={14} /></button>
          </div>
          <div className="flex flex-col gap-0.5 mt-2">
            {sections.map(sec => {
              const cells = cellCounts[sec.id] ?? 0;
              const active = selectedSecId === sec.id && tool === "draw";
              return (
                <button key={sec.id} onClick={() => { onSelectSection(sec.id); setTool("draw"); }}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-left w-full transition-colors ${
                    active ? "bg-[#1e3d18] border border-[rgba(122,182,72,0.28)]" : "hover:bg-[#1a2d16] border border-transparent"
                  }`}>
                  <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: sec.color + "33", border: `1px solid ${sec.color}55` }}>
                    <span style={{ fontSize: 13 }}>{iconFor(sec.type)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[#b8d4ac] truncate leading-tight">{sec.name}</p>
                    {cells > 0 && <p className="text-[10px] font-mono text-[#6a8f5e] leading-tight">{fmtAcres(cells, cellM)} ac</p>}
                  </div>
                </button>
              );
            })}
            {noSections && <p className="text-[11px] text-[#6a8f5e] leading-relaxed">No sections yet. Add one, then paint it onto the map.</p>}
          </div>
        </div>

        <div className="p-3 border-t border-[rgba(122,182,72,0.08)] hidden md:block">
          <p className={labelCls}>Land Use · {fmtAcres(totalFilled, cellM)} ac</p>
          {/* 1px surface-colour seam between segments keeps neighbouring similar hues separable */}
          <div className="flex h-3 rounded overflow-hidden bg-[#0a1809] mb-2">
            {landUse.map(({ sec, cells }) => (
              <div key={sec.id} title={`${sec.name}: ${fmtAcres(cells, cellM)} ac`}
                style={{ width: `${(cells / totalCells) * 100}%`, backgroundColor: sec.color, flexShrink: 0, boxSizing: "border-box", borderRight: "1px solid #0a1809" }} />
            ))}
            {totalFilled < totalCells && <div style={{ flex: 1, backgroundColor: EMPTY_COLOR }} />}
          </div>
          <div className="flex flex-col gap-1">
            {landUse.slice(0, 6).map(({ sec, cells }) => (
              <div key={sec.id} className="flex items-center gap-1.5">
                <span style={{ fontSize: 11 }}>{iconFor(sec.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#6a8f5e] truncate">{sec.name}</span>
                    <span className="text-[10px] font-mono text-[#b8d4ac] ml-1">{fmtAcres(cells, cellM)}ac</span>
                  </div>
                  <div className="h-1 rounded bg-[#1a2d16] mt-0.5 overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${(cells / totalCells) * 100}%`, backgroundColor: sec.color + "cc" }} />
                  </div>
                </div>
              </div>
            ))}
            {landUse.length > 6 && <p className="text-[10px] text-[#6a8f5e] text-center">+{landUse.length - 6} more</p>}
          </div>
        </div>
      </div>

      {/* ── Map panel ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[rgba(122,182,72,0.1)] bg-[#0e1e0c] flex-shrink-0 flex-wrap gap-y-1.5">
          <div className="flex items-center gap-1">
            <button onClick={() => setZoomIdx(Math.max(0, zi - 1))} disabled={zi === 0} aria-label="Zoom out"
              className="p-1.5 rounded bg-[#1a2d16] text-[#6a8f5e] hover:text-[#ddefd4] disabled:opacity-30 transition-colors"><ZoomOut size={13} /></button>
            <span className="text-[11px] font-mono text-[#6a8f5e] w-24 text-center select-none">{px}px · {cellM}m/cell</span>
            <button onClick={() => setZoomIdx(Math.min(zoomLevels.length - 1, zi + 1))} disabled={zi === zoomLevels.length - 1} aria-label="Zoom in"
              className="p-1.5 rounded bg-[#1a2d16] text-[#6a8f5e] hover:text-[#ddefd4] disabled:opacity-30 transition-colors"><ZoomIn size={13} /></button>
          </div>
          <div className="h-3.5 w-px bg-[rgba(122,182,72,0.2)]" />
          <button onClick={onFarmSettings}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#1a2d16] border border-[rgba(122,182,72,0.2)] text-[11px] font-mono text-[#ddefd4] hover:bg-[#243d20] hover:border-[rgba(122,182,72,0.4)] transition-colors">
            <Maximize2 size={12} className="text-[#7ab648]" />
            Resize Farm
            <span className="text-[#6a8f5e]">· {farm.widthMeters}m × {farm.heightMeters}m</span>
          </button>
          <span className="text-[11px] font-mono text-[#6a8f5e]" aria-live="polite">{saving ? "Saving…" : "All changes saved"}</span>
          <div className="ml-auto text-[11px] font-mono text-[#6a8f5e]">
            {hover
              ? `${hoverSec ? hoverSec.name : "Empty"} · ${hover.c * cellM}m E, ${hover.r * cellM}m N`
              : `${fmtAcres(totalFilled, cellM)} / ${fmtAcres(totalCells, cellM)} ac mapped`}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 bg-[#081508] relative">
          {noSections && (
            <div className="absolute inset-4 z-10 flex items-center justify-center pointer-events-none">
              <div className="pointer-events-auto text-center rounded-xl bg-[#0e1e0c]/95 border border-[rgba(122,182,72,0.25)] px-6 py-5 max-w-xs">
                <Leaf size={26} className="mx-auto mb-2 text-[#7ab648]" />
                <p className="text-sm text-[#ddefd4] mb-1">Create your first section</p>
                <p className="text-xs text-[#6a8f5e] mb-3 leading-relaxed">Sections are the crops, structures and water features you paint onto the map.</p>
                <button onClick={onAddSection}
                  className="px-3 py-2 rounded bg-[#7ab648] text-[#0a1809] text-sm font-medium hover:bg-[#9ed460] transition-colors">New Section</button>
              </div>
            </div>
          )}
          <div className="relative inline-block select-none"
            style={{ width: cols * px, height: rows * px, cursor: tool === "draw" ? "crosshair" : "cell", touchAction: "none" }}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove}
            onPointerUp={endStroke} onPointerCancel={endStroke}
            onPointerLeave={() => { setHover(null); }}>
            <canvas ref={baseRef} aria-label="Farm map" style={{ display: "block", imageRendering: "pixelated" }} />
            <canvas ref={overlayRef} className="absolute inset-0 pointer-events-none" />
          </div>
        </div>

        <div className="px-4 py-2 border-t border-[rgba(122,182,72,0.08)] bg-[#0e1e0c] flex items-center gap-6 flex-shrink-0 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="h-2 border border-[rgba(255,255,255,0.35)] border-t-0" style={{ width: scaleCells * px }} />
            <span className="text-[10px] font-mono text-[#6a8f5e]">{scaleCells * cellM}m</span>
          </div>
          <span className="text-[10px] font-mono text-[#6a8f5e]">
            Grid {cols}×{rows} cells · {cellM}m/cell · {farm.widthMeters}m × {farm.heightMeters}m
          </span>
        </div>
      </div>
    </div>
  );
}
