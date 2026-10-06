import { useMemo } from "react";
import { Clock, Droplets, Pencil, Plus, Trash2 } from "lucide-react";
import type { SectionDto } from "../api/types";
import type { FarmData } from "./useFarmData";
import { EMPTY_COLOR, cellsToSquareMeters, fmtAcres, fmtDate, fmtMoney, iconFor, labelFor } from "../format";

interface Props {
  data: FarmData;
  onAdd: () => void;
  onEdit: (s: SectionDto) => void;
  onDelete: (s: SectionDto) => void;
}

export function SectionsTab({ data, onAdd, onEdit, onDelete }: Props) {
  const { sections, tasks, summary, dims, cellCounts } = data;
  const { cols, rows, cellSize } = dims;
  const totalCells = cols * rows;
  const totalFilled = useMemo(() => Object.values(cellCounts).reduce((a, b) => a + b, 0), [cellCounts]);

  const landUse = useMemo(
    () => sections.map(s => ({ sec: s, cells: cellCounts[s.id] ?? 0 })).filter(x => x.cells > 0).sort((a, b) => b.cells - a.cells),
    [sections, cellCounts],
  );
  const money = useMemo(() => new Map((summary?.bySection ?? []).map(b => [b.sectionId, b])), [summary]);

  return (
    <div className="p-4 md:p-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="text-xl text-[#ddefd4]">Farm Sections</h2>
          <p className="text-sm text-[#6a8f5e] mt-0.5">
            {sections.length} section{sections.length !== 1 ? "s" : ""} · {fmtAcres(totalFilled, cellSize)} / {fmtAcres(totalCells, cellSize)} acres mapped
          </p>
        </div>
        <button onClick={onAdd}
          className="flex items-center gap-2 px-3 py-2 rounded bg-[#7ab648] text-[#0a1809] text-sm font-medium hover:bg-[#9ed460] transition-colors">
          <Plus size={14} />New Section
        </button>
      </div>

      {sections.length === 0 ? (
        <div className="text-center py-16 text-[#6a8f5e]">
          <p className="text-3xl mb-3">🌱</p>
          <p className="text-sm text-[#b8d4ac] mb-1">No sections yet</p>
          <p className="text-xs">Add crops, structures or water features, then paint them on the Farm Map.</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-[rgba(122,182,72,0.1)] bg-[#152a12] p-4 mb-5">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h3 className="text-sm font-medium text-[#ddefd4]">Land Allocation</h3>
              <span className="text-xs font-mono text-[#6a8f5e]">
                {fmtAcres(totalFilled, cellSize)} ac used of {fmtAcres(totalCells, cellSize)} ac ({totalCells ? ((totalFilled / totalCells) * 100).toFixed(0) : 0}%)
              </span>
            </div>
            <div className="flex h-5 rounded overflow-hidden bg-[#0a1809] mb-3">
              {landUse.map(({ sec, cells }) => (
                <div key={sec.id} className="flex items-center justify-center overflow-hidden" title={`${sec.name}: ${fmtAcres(cells, cellSize)} ac`}
                  style={{ width: `${(cells / totalCells) * 100}%`, backgroundColor: sec.color, flexShrink: 0, boxSizing: "border-box", borderRight: "1px solid #0a1809" }}>
                  {cells / totalCells > 0.06 && <span style={{ fontSize: 11 }}>{iconFor(sec.type)}</span>}
                </div>
              ))}
              {totalFilled < totalCells && <div style={{ flex: 1, backgroundColor: EMPTY_COLOR }} />}
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
              {landUse.map(({ sec, cells }) => (
                <div key={sec.id} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: sec.color }} />
                  <span className="text-[11px] text-[#6a8f5e] truncate flex-1">{sec.name}</span>
                  <span className="text-[11px] font-mono text-[#b8d4ac] flex-shrink-0">{fmtAcres(cells, cellSize)} ac</span>
                </div>
              ))}
              {landUse.length === 0 && <p className="text-xs text-[#6a8f5e] col-span-full">Nothing painted yet — open the Farm Map to start.</p>}
            </div>
          </div>

          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(310px, 100%), 1fr))" }}>
            {sections.map(sec => {
              const cells = cellCounts[sec.id] ?? 0;
              const pending = tasks.filter(t => t.sectionId === sec.id && !t.done).length;
              const m = money.get(sec.id);
              return (
                <div key={sec.id} className="rounded-xl border border-[rgba(122,182,72,0.12)] bg-[#152a12] p-4 hover:border-[rgba(122,182,72,0.25)] transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-xl"
                        style={{ backgroundColor: sec.color + "22", border: `1px solid ${sec.color}44` }}>{iconFor(sec.type)}</div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium text-[#ddefd4] leading-tight break-words">{sec.name}</h3>
                        <p className="text-xs text-[#6a8f5e] mt-0.5">{labelFor(sec.type)}</p>
                        {cells > 0 ? (
                          <p className="text-xs font-mono text-[#7ab648] mt-0.5">
                            {fmtAcres(cells, cellSize)} ac · {cellsToSquareMeters(cells, cellSize).toLocaleString()} m²
                            <span className="text-[#6a8f5e] ml-1">({((cells / totalCells) * 100).toFixed(1)}% of farm)</span>
                          </p>
                        ) : (
                          <p className="text-xs text-[#6a8f5e] mt-0.5 italic">Not painted on the map yet</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2 flex-shrink-0">
                      <button onClick={() => onEdit(sec)} aria-label={`Edit ${sec.name}`} className="p-1.5 text-[#6a8f5e] hover:text-[#7ab648] transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => onDelete(sec)} aria-label={`Delete ${sec.name}`} className="p-1.5 text-[#6a8f5e] hover:text-[#d94832] transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </div>

                  {sec.cropDetails && <p className="text-xs text-[#b8d4ac] mb-3 leading-relaxed">{sec.cropDetails}</p>}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mb-3">
                    {sec.plantDate && (<><span className="text-[#6a8f5e]">Planted</span><span className="text-[#b8d4ac] font-mono">{fmtDate(sec.plantDate)}</span></>)}
                    {sec.harvestDate && (<><span className="text-[#6a8f5e]">Harvest</span><span className="text-[#b8d4ac] font-mono">{fmtDate(sec.harvestDate)}</span></>)}
                    {sec.waterSchedule && (<><span className="text-[#6a8f5e] flex items-center gap-1"><Droplets size={10} />Water</span><span className="text-[#b8d4ac]">{sec.waterSchedule}</span></>)}
                  </div>
                  {sec.notes && <p className="text-[11px] text-[#7aa86a] italic mb-3">{sec.notes}</p>}
                  {m && (m.income > 0 || m.expense > 0) && (
                    <div className="flex gap-4 pt-3 border-t border-[rgba(122,182,72,0.08)] text-xs font-mono">
                      <span className="text-[#7ab648]">+{fmtMoney(m.income)}</span>
                      <span className="text-[#d94832]">−{fmtMoney(m.expense)}</span>
                    </div>
                  )}
                  {pending > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#d4a843]">
                      <Clock size={11} />{pending} pending task{pending !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
