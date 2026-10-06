import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Plus, Trash2 } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FinanceRecordDto, FinanceRecordInput, FinanceType, SectionDto } from "../api/types";
import { financeApi } from "../api/endpoints";
import { errorMessage } from "../api/client";
import type { FarmData } from "./useFarmData";
import { fmtDate, fmtMoney, fmtMoneyShort, iconFor, todayLocal } from "../format";
import { CURRENCY } from "../config";
import { ConfirmDialog, ErrorNote, Field, Modal, Spinner, inputCls } from "../ui";
import { useToast } from "../Toasts";

const PAGE_SIZE = 50;
type Filter = "all" | FinanceType;

const tooltipStyle = {
  contentStyle: { backgroundColor: "#0e1e0c", border: "1px solid rgba(122,182,72,0.18)", borderRadius: 6, fontSize: 12 },
  labelStyle: { color: "#ddefd4" },
};

function RecordModal({ sections, onSave, onClose }: { sections: SectionDto[]; onSave: (i: FinanceRecordInput) => Promise<void>; onClose: () => void }) {
  const [type, setType] = useState<FinanceType>("expense");
  const [date, setDate] = useState(todayLocal());
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountNum = Number(amount);
  const valid = !!date && category.trim() !== "" && description.trim() !== "" && Number.isFinite(amountNum) && amountNum > 0;

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await onSave({ date, type, category: category.trim(), amount: amountNum, description: description.trim(), sectionId: sectionId || null });
    } catch (err) { setError(errorMessage(err)); setBusy(false); }
  };

  return (
    <Modal title="Add Transaction" onClose={onClose} onSubmit={submit} busy={busy} error={error} disabled={!valid}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type" htmlFor="fin-type">
          <select id="fin-type" className={inputCls} value={type} onChange={e => setType(e.target.value as FinanceType)}>
            <option value="income">Income</option><option value="expense">Expense</option>
          </select>
        </Field>
        <Field label="Date" htmlFor="fin-date">
          <input id="fin-date" type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" htmlFor="fin-cat">
          <input id="fin-cat" className={inputCls} placeholder="Crop Sale, Labor, Seeds…" value={category} maxLength={100} onChange={e => setCategory(e.target.value)} />
        </Field>
        <Field label={`Amount (${CURRENCY})`} htmlFor="fin-amount">
          <input id="fin-amount" type="number" min={0} step="any" className={inputCls} placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
        </Field>
      </div>
      <Field label="Description" htmlFor="fin-desc">
        <input id="fin-desc" className={inputCls} placeholder="Brief description of the transaction" value={description} maxLength={500} onChange={e => setDescription(e.target.value)} />
      </Field>
      <Field label="Section (optional)" htmlFor="fin-section">
        <select id="fin-section" className={inputCls} value={sectionId} onChange={e => setSectionId(e.target.value)}>
          <option value="">— Farm-wide —</option>
          {sections.map(s => <option key={s.id} value={s.id}>{iconFor(s.type)} {s.name}</option>)}
        </select>
      </Field>
    </Modal>
  );
}

export function FinanceTab({ data }: { data: FarmData }) {
  const { farm, sections, summary, refreshSummary } = data;
  const toast = useToast();

  const [filter, setFilter] = useState<Filter>("all");
  const [records, setRecords] = useState<FinanceRecordDto[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<FinanceRecordDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const requestId = useRef(0);

  const sectionMap = useMemo(() => new Map(sections.map(s => [s.id, s])), [sections]);

  const load = useCallback(async (nextPage: number, append: boolean) => {
    const id = ++requestId.current;
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await financeApi.records(farm.id, { type: filter === "all" ? undefined : filter, page: nextPage, pageSize: PAGE_SIZE });
      if (id !== requestId.current) return; // a newer request superseded this one
      setRecords(prev => (append ? [...prev, ...rows] : rows));
      setPage(nextPage);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (err) {
      if (id === requestId.current) setLoadError(errorMessage(err, "Couldn't load transactions."));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [farm.id, filter]);

  useEffect(() => { void load(1, false); }, [load]);

  const create = async (input: FinanceRecordInput) => {
    await financeApi.create(farm.id, input);
    setAdding(false);
    toast.success("Transaction added");
    void load(1, false);
    void refreshSummary();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true); setDeleteError(null);
    try {
      await financeApi.remove(farm.id, deleting.id);
      setRecords(prev => prev.filter(r => r.id !== deleting.id));
      setDeleting(null);
      toast.success("Transaction deleted");
      void refreshSummary();
    } catch (err) {
      setDeleteError(errorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  const s = summary;
  const tiles = s ? [
    { label: "Total Income", value: fmtMoney(s.totalIncome), sub: "All income recorded", color: "#7ab648", up: true },
    { label: "Total Expenses", value: fmtMoney(s.totalExpense), sub: "All costs recorded", color: "#e8604a", up: false },
    { label: "Net Profit", value: fmtMoney(s.netProfit), sub: s.netProfit >= 0 ? "In profit" : "At a loss", color: s.netProfit >= 0 ? "#7ab648" : "#e8604a", up: s.netProfit >= 0 },
    { label: "Projected Annual", value: fmtMoney(s.projectedAnnualIncome), sub: `ROI ${s.roiPercent.toFixed(1)}% · 3-mo avg`, color: "#d4a843", up: true },
  ] : [];

  const hasData = !!s && (s.totalIncome > 0 || s.totalExpense > 0);
  const bySection = (s?.bySection ?? []).filter(b => b.income > 0 || b.expense > 0).sort((a, b) => b.profit - a.profit);

  return (
    <div className="p-4 md:p-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="text-xl text-[#ddefd4]">Farm Finance</h2>
          <p className="text-sm text-[#6a8f5e] mt-0.5">Income and expenses across the whole farm</p>
        </div>
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-2 px-3 py-2 rounded bg-[#7ab648] text-[#0a1809] text-sm font-medium hover:bg-[#9ed460] transition-colors">
          <Plus size={14} />Add Record
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5 lg:grid-cols-4">
        {tiles.map(({ label, value, sub, color, up }) => (
          <div key={label} className="rounded-xl border border-[rgba(122,182,72,0.1)] bg-[#152a12] p-4 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <span className="text-[11px] text-[#6a8f5e]">{label}</span>
              {up ? <ArrowUpRight size={14} style={{ color }} /> : <ArrowDownRight size={14} style={{ color }} />}
            </div>
            <p className="text-base font-mono font-medium truncate" style={{ color }} title={value}>{value}</p>
            <p className="text-[11px] text-[#6a8f5e] mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {hasData && s && (
        <>
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
                <BarChart data={s.monthlyBreakdown} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="monthLabel" tick={{ fill: "#6a8f5e", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6a8f5e", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fmtMoneyShort(v).replace(`${CURRENCY} `, "")} />
                  <Tooltip {...tooltipStyle} formatter={(val: number, nm: string) => [fmtMoney(val), nm]} />
                  <Bar name="Income" dataKey="income" fill="#7ab648" radius={[3, 3, 0, 0]} maxBarSize={36} />
                  <Bar name="Expenses" dataKey="expense" fill="#d4a843" radius={[3, 3, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-xl border border-[rgba(122,182,72,0.1)] bg-[#152a12] p-4">
              <h3 className="text-sm font-medium text-[#ddefd4] mb-3">Cumulative Profit</h3>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={s.cumulativeProfit} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="farmProfitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7ab648" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#7ab648" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="monthLabel" tick={{ fill: "#6a8f5e", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6a8f5e", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fmtMoneyShort(v).replace(`${CURRENCY} `, "")} />
                  <Tooltip {...tooltipStyle} formatter={(val: number) => [fmtMoney(val), "Cumulative Profit"]} />
                  <Area name="Cumulative Profit" type="monotone" dataKey="cumulative" stroke="#7ab648" strokeWidth={2} fill="url(#farmProfitGrad)" dot={{ fill: "#7ab648", r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {bySection.length > 0 && (
            <div className="rounded-xl border border-[rgba(122,182,72,0.1)] bg-[#152a12] p-4 mb-5">
              <h3 className="text-sm font-medium text-[#ddefd4] mb-3">By Section</h3>
              <div className="flex flex-col gap-2">
                {bySection.map(b => (
                  <div key={b.sectionId} className="flex items-center gap-3">
                    <span style={{ fontSize: 14 }}>{b.icon}</span>
                    <span className="text-xs text-[#b8d4ac] w-28 md:w-32 flex-shrink-0 truncate">{b.sectionName}</span>
                    <div className="flex-1 h-1.5 rounded bg-[#1a2d16] overflow-hidden min-w-4">
                      <div className="h-full rounded" style={{ width: `${s.totalIncome > 0 ? Math.round((b.income / s.totalIncome) * 100) : 0}%`, backgroundColor: b.color + "cc" }} />
                    </div>
                    <span className="text-xs font-mono text-[#7ab648] w-20 md:w-28 text-right hidden sm:block">{fmtMoneyShort(b.income)}</span>
                    <span className={`text-xs font-mono w-20 md:w-28 text-right ${b.profit >= 0 ? "text-[#7ab648]" : "text-[#e8604a]"}`}>
                      {b.profit >= 0 ? "+" : "−"}{fmtMoneyShort(Math.abs(b.profit))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="rounded-xl border border-[rgba(122,182,72,0.1)] bg-[#152a12]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(122,182,72,0.08)]">
          <h3 className="text-sm font-medium text-[#ddefd4]">Transactions</h3>
          <div className="flex rounded overflow-hidden border border-[rgba(122,182,72,0.15)]" role="group" aria-label="Filter transactions">
            {(["all", "income", "expense"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
                className={`px-2.5 py-1 text-[11px] capitalize transition-colors ${filter === f ? "bg-[#7ab648] text-[#0a1809]" : "bg-transparent text-[#6a8f5e] hover:bg-[#1e3818]"}`}>{f}</button>
            ))}
          </div>
        </div>

        {loadError && <div className="p-4"><ErrorNote message={loadError} /></div>}

        <div className="divide-y divide-[rgba(122,182,72,0.05)]">
          {records.map(r => {
            const sec = r.sectionId ? sectionMap.get(r.sectionId) : undefined;
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#0e1e0c] transition-colors group">
                <div className={`w-0.5 h-7 rounded-full flex-shrink-0 ${r.type === "income" ? "bg-[#7ab648]" : "bg-[#e8604a]"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#ddefd4] truncate">{r.description}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a2d16] text-[#8fb07e] flex-shrink-0">{r.category}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-[#6a8f5e] font-mono">
                    <span>{fmtDate(r.date)}</span>
                    {(sec || r.sectionName) && <span className="flex items-center gap-1 truncate">{sec && <span>{iconFor(sec.type)}</span>}{sec?.name ?? r.sectionName}</span>}
                  </div>
                </div>
                <span className={`text-sm font-mono font-medium flex-shrink-0 ${r.type === "income" ? "text-[#7ab648]" : "text-[#e8604a]"}`}>
                  {r.type === "income" ? "+" : "−"} {fmtMoney(r.amount)}
                </span>
                <button onClick={() => { setDeleteError(null); setDeleting(r); }} aria-label={`Delete transaction ${r.description}`}
                  className="opacity-60 md:opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 text-[#6a8f5e] hover:text-[#d94832]">
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>

        {!loading && !loadError && records.length === 0 && (
          <p className="text-center text-sm text-[#6a8f5e] py-10">
            {filter === "all" ? "No transactions yet — add your first income or expense." : `No ${filter} transactions.`}
          </p>
        )}
        {loading && <div className="flex justify-center py-6 text-[#6a8f5e]"><Spinner /></div>}
        {hasMore && !loading && (
          <div className="p-3 text-center border-t border-[rgba(122,182,72,0.05)]">
            <button onClick={() => void load(page + 1, true)} className="text-xs text-[#7ab648] hover:text-[#9ed460] underline underline-offset-2">Load more</button>
          </div>
        )}
      </div>

      {adding && <RecordModal sections={sections} onClose={() => setAdding(false)} onSave={create} />}
      {deleting && (
        <ConfirmDialog title="Delete transaction?" busy={deleteBusy} error={deleteError} onConfirm={confirmDelete} onClose={() => setDeleting(null)}
          message={<>This permanently removes <span className="text-[#ddefd4]">{deleting.description}</span> ({fmtMoney(deleting.amount)}) and updates your totals.</>} />
      )}
    </div>
  );
}
