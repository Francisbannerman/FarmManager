import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { farmsApi, financeApi, gridApi, sectionsApi, tasksApi } from "../api/endpoints";
import { errorMessage } from "../api/client";
import type { Farm, FinanceSummary, GridSnapshot, SectionDto, SectionInput, TaskDto, TaskInput } from "../api/types";
import { useToast } from "../Toasts";

const MAX_CHANGES_PER_REQUEST = 20_000; // backend limit for PUT /grid
const FLUSH_DELAY_MS = 300;

interface Dims { cols: number; rows: number; cellSize: number }

function cellsFromSnapshot(snap: GridSnapshot): (string | null)[] {
  const cells = new Array<string | null>(snap.gridColumns * snap.gridRows).fill(null);
  for (const c of snap.cells) {
    if (c.row < snap.gridRows && c.col < snap.gridColumns) cells[c.row * snap.gridColumns + c.col] = c.sectionId;
  }
  return cells;
}

/**
 * Owns every piece of server-backed state for one farm.
 *
 * Grid painting is optimistic: cells change locally at once, are queued, and
 * are sent in batches (one PUT /grid per burst of painting, never one request
 * per cell). If a batch fails the grid is re-read from the server so the
 * screen never keeps edits that were not saved.
 */
export function useFarmData(initialFarm: Farm) {
  const toast = useToast();

  const [farm, setFarm] = useState<Farm>(initialFarm);
  const [sections, setSections] = useState<SectionDto[]>([]);
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dims, setDims] = useState<Dims>({ cols: initialFarm.gridColumns, rows: initialFarm.gridRows, cellSize: initialFarm.cellSizeMeters });
  const dimsRef = useRef(dims);
  dimsRef.current = dims;
  const cellsRef = useRef<(string | null)[]>(new Array(initialFarm.gridColumns * initialFarm.gridRows).fill(null));
  const [gridVersion, setGridVersion] = useState(0);
  const bumpGrid = useCallback(() => setGridVersion(v => v + 1), []);

  const farmId = farm.id;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  // ── loading ────────────────────────────────────────────────────────────────
  const applySnapshot = useCallback((snap: GridSnapshot) => {
    cellsRef.current = cellsFromSnapshot(snap);
    setDims({ cols: snap.gridColumns, rows: snap.gridRows, cellSize: snap.cellSizeMeters });
    bumpGrid();
  }, [bumpGrid]);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [secs, snap, tks, sum] = await Promise.all([
        sectionsApi.list(farmId), gridApi.get(farmId), tasksApi.list(farmId), financeApi.summary(farmId),
      ]);
      if (!mounted.current) return;
      setSections(secs);
      setTasks(tks);
      setSummary(sum);
      applySnapshot(snap);
    } catch (err) {
      if (mounted.current) setLoadError(errorMessage(err, "Couldn't load your farm."));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [farmId, applySnapshot]);

  useEffect(() => { void reload(); }, [reload]);

  const refreshSummary = useCallback(async () => {
    try {
      const sum = await financeApi.summary(farmId);
      if (mounted.current) setSummary(sum);
    } catch { /* the figures refresh on the next successful call */ }
  }, [farmId]);

  // ── grid painting ──────────────────────────────────────────────────────────
  const pending = useRef(new Map<number, string | null>());
  const flushing = useRef<Promise<void> | null>(null);
  const timer = useRef<number | null>(null);
  const [saving, setSaving] = useState(false);

  const runFlush = useCallback(async () => {
    const { cols } = dimsRef.current;
    while (pending.current.size > 0) {
      const entries = [...pending.current.entries()];
      pending.current.clear();
      for (let i = 0; i < entries.length; i += MAX_CHANGES_PER_REQUEST) {
        const changes = entries.slice(i, i + MAX_CHANGES_PER_REQUEST)
          .map(([idx, sectionId]) => ({ row: Math.floor(idx / cols), col: idx % cols, sectionId }));
        try {
          await gridApi.update(farmId, changes);
        } catch (err) {
          pending.current.clear();
          toast.error(`${errorMessage(err, "Couldn't save your map changes.")} The map was restored to the last saved version.`);
          try { applySnapshot(await gridApi.get(farmId)); } catch { /* still offline — a reload will resync */ }
          return;
        }
      }
    }
  }, [farmId, applySnapshot, toast]);

  /** Send everything queued so far. Safe to call repeatedly; resolves when the queue is empty. */
  const flushPaint = useCallback(async () => {
    if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; }
    if (!flushing.current) {
      setSaving(true);
      flushing.current = runFlush().finally(() => {
        flushing.current = null;
        if (mounted.current) setSaving(false);
      });
    }
    await flushing.current;
    if (pending.current.size > 0) await flushPaint();
  }, [runFlush]);

  const paint = useCallback((row: number, col: number, sectionId: string | null) => {
    const { cols, rows } = dimsRef.current;
    if (row < 0 || col < 0 || row >= rows || col >= cols) return;
    const idx = row * cols + col;
    if (cellsRef.current[idx] === sectionId) return;
    cellsRef.current[idx] = sectionId;
    pending.current.set(idx, sectionId);
    bumpGrid();
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void flushPaint(); }, FLUSH_DELAY_MS);
  }, [bumpGrid, flushPaint]);

  // Don't silently lose unsaved strokes if the tab is closed mid-save.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pending.current.size > 0 || flushing.current) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Push any queued strokes out when leaving the dashboard.
  useEffect(() => () => { if (pending.current.size > 0) void runFlush(); }, [runFlush]);

  // ── derived ────────────────────────────────────────────────────────────────
  const cellCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const id of cellsRef.current) if (id) counts[id] = (counts[id] ?? 0) + 1;
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridVersion]);

  // ── farm ───────────────────────────────────────────────────────────────────
  const updateFarm = useCallback(async (name: string, widthMeters: number, heightMeters: number) => {
    let cleared = 0;
    if (name !== farm.name) setFarm(await farmsApi.rename(farmId, name));
    if (widthMeters !== farm.widthMeters || heightMeters !== farm.heightMeters) {
      await flushPaint();
      const result = await farmsApi.resize(farmId, widthMeters, heightMeters);
      cleared = result.clearedCellCount;
      setFarm(result.farm);
      applySnapshot(await gridApi.get(farmId));
    }
    return cleared;
  }, [farm, farmId, flushPaint, applySnapshot]);

  // ── sections ───────────────────────────────────────────────────────────────
  const createSection = useCallback(async (input: SectionInput) => {
    const created = await sectionsApi.create(farmId, input);
    setSections(prev => [...prev, created]);
    return created;
  }, [farmId]);

  const updateSection = useCallback(async (id: string, input: SectionInput) => {
    const updated = await sectionsApi.update(farmId, id, input);
    setSections(prev => prev.map(s => (s.id === id ? updated : s)));
    return updated;
  }, [farmId]);

  const deleteSection = useCallback(async (id: string) => {
    await flushPaint();
    await sectionsApi.remove(farmId, id);
    setSections(prev => prev.filter(s => s.id !== id));
    const cells = cellsRef.current;
    for (let i = 0; i < cells.length; i++) if (cells[i] === id) cells[i] = null;
    bumpGrid();
    setTasks(prev => prev.map(t => (t.sectionId === id ? { ...t, sectionId: null, sectionName: null } : t)));
    void refreshSummary();
  }, [farmId, flushPaint, bumpGrid, refreshSummary]);

  // ── tasks ──────────────────────────────────────────────────────────────────
  const addTask = useCallback(async (input: TaskInput) => {
    const created = await tasksApi.create(farmId, input);
    setTasks(prev => [...prev, created]);
  }, [farmId]);

  const toggleTask = useCallback(async (id: string) => {
    try {
      const updated = await tasksApi.toggle(farmId, id);
      setTasks(prev => prev.map(t => (t.id === id ? updated : t)));
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't update that activity."));
    }
  }, [farmId, toast]);

  const deleteTask = useCallback(async (id: string) => {
    await tasksApi.remove(farmId, id);
    setTasks(prev => prev.filter(t => t.id !== id));
  }, [farmId]);

  return {
    farm, sections, tasks, summary, loading, loadError, reload,
    dims, cellsRef, gridVersion, cellCounts, saving,
    paint, flushPaint,
    updateFarm,
    createSection, updateSection, deleteSection,
    addTask, toggleTask, deleteTask,
    refreshSummary,
  };
}

export type FarmData = ReturnType<typeof useFarmData>;
