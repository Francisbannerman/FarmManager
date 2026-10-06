import { useMemo, useState } from "react";
import { AlertTriangle, Calendar, Check, CheckSquare2, Plus, Trash2 } from "lucide-react";
import type { Priority, SectionDto, TaskDto, TaskInput } from "../api/types";
import { errorMessage } from "../api/client";
import type { FarmData } from "./useFarmData";
import { fmtDate, fmtMoney, iconFor, priorityColor } from "../format";
import { Field, Modal, inputCls } from "../ui";
import { useToast } from "../Toasts";

type Filter = "all" | "pending" | "done";

function TaskRow({ t, section, today, onToggle, onDelete }: {
  t: TaskDto; section: SectionDto | undefined; today: string; onToggle: () => void; onDelete: () => void;
}) {
  const overdue = !t.done && t.dueDate < today;
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors group ${
      t.done ? "bg-[#0e1a0c] border-[rgba(122,182,72,0.05)] opacity-60"
      : overdue ? "bg-[#1f1108] border-[rgba(217,72,50,0.18)] hover:border-[rgba(217,72,50,0.35)]"
      : "bg-[#152a12] border-[rgba(122,182,72,0.1)] hover:border-[rgba(122,182,72,0.25)]"
    }`}>
      <button onClick={onToggle} role="checkbox" aria-checked={t.done} aria-label={`Mark "${t.title}" as ${t.done ? "not done" : "done"}`}
        className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-all ${
          t.done ? "bg-[#7ab648] border-[#7ab648]" : "border-[rgba(122,182,72,0.4)] hover:border-[#7ab648]"
        }`}>
        {t.done && <Check size={10} className="text-[#0a1809]" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <span className={`text-sm leading-snug flex-1 break-words ${t.done ? "line-through text-[#6a8f5e]" : "text-[#ddefd4]"}`}>{t.title}</span>
          <span className="mt-1 flex-shrink-0 text-[9px] font-mono uppercase tracking-wide px-1.5 py-px rounded"
            style={{ color: priorityColor(t.priority), border: `1px solid ${priorityColor(t.priority)}66` }}>{t.priority}</span>
        </div>
        <div className="flex items-center flex-wrap gap-2 mt-1.5">
          {section && (
            <span className="text-[11px] px-1.5 py-0.5 rounded font-mono flex items-center gap-1"
              style={{ backgroundColor: section.color + "20", color: section.color }}>
              <span>{iconFor(section.type)}</span>{section.name}
            </span>
          )}
          <span className={`text-[11px] font-mono flex items-center gap-1 ${overdue ? "text-[#e8604a]" : "text-[#6a8f5e]"}`}>
            <Calendar size={10} />
            {t.done ? `Done ${fmtDate(t.completedDate)}` : fmtDate(t.dueDate)}
            {overdue && " · overdue"}
          </span>
          {t.estimatedCost > 0 && <span className="text-[11px] font-mono text-[#6a8f5e]">{fmtMoney(t.estimatedCost)}</span>}
        </div>
        {t.notes && <p className="text-[11px] text-[#7aa86a] mt-1 italic">{t.notes}</p>}
      </div>
      <button onClick={onDelete} aria-label={`Delete "${t.title}"`}
        className="opacity-60 md:opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 text-[#6a8f5e] hover:text-[#d94832] flex-shrink-0">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function Group({ label, color, children, count }: { label: string; color: string; count: number; children: React.ReactNode }) {
  if (!count) return null;
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color }}>{label}</span>
        <span className="text-[10px] font-mono text-[#6a8f5e]">{count}</span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function TaskModal({ sections, today, onSave, onClose }: { sections: SectionDto[]; today: string; onSave: (i: TaskInput) => Promise<void>; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState(today);
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costNum = cost === "" ? 0 : Number(cost);
  const valid = title.trim().length > 0 && !!dueDate && Number.isFinite(costNum) && costNum >= 0;

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await onSave({ title: title.trim(), sectionId: sectionId || null, dueDate, priority, estimatedCost: costNum || null, notes: notes.trim() || null });
    } catch (err) { setError(errorMessage(err)); setBusy(false); }
  };

  return (
    <Modal title="New Activity" onClose={onClose} onSubmit={submit} busy={busy} error={error} disabled={!valid}>
      <Field label="Activity Description" htmlFor="task-title">
        <input id="task-title" className={inputCls} placeholder="What needs to be done?" value={title} maxLength={200} onChange={e => setTitle(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Section" htmlFor="task-section">
          <select id="task-section" className={inputCls} value={sectionId} onChange={e => setSectionId(e.target.value)}>
            <option value="">— Farm-wide —</option>
            {sections.map(s => <option key={s.id} value={s.id}>{iconFor(s.type)} {s.name}</option>)}
          </select>
        </Field>
        <Field label="Priority" htmlFor="task-priority">
          <select id="task-priority" className={inputCls} value={priority} onChange={e => setPriority(e.target.value as Priority)}>
            <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Due Date" htmlFor="task-due">
          <input id="task-due" type="date" className={inputCls} value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </Field>
        <Field label="Estimated Cost" htmlFor="task-cost">
          <input id="task-cost" type="number" min={0} step="any" className={inputCls} placeholder="0" value={cost} onChange={e => setCost(e.target.value)} />
        </Field>
      </div>
      <Field label="Notes" htmlFor="task-notes">
        <textarea id="task-notes" className={inputCls + " resize-none h-16"} placeholder="Instructions, reminders…" value={notes} maxLength={2000} onChange={e => setNotes(e.target.value)} />
      </Field>
    </Modal>
  );
}

export function ActivitiesTab({ data, today }: { data: FarmData; today: string }) {
  const { tasks, sections, toggleTask, deleteTask, addTask } = data;
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);

  const sectionMap = useMemo(() => new Map(sections.map(s => [s.id, s])), [sections]);
  const pending = tasks.filter(t => !t.done);
  const dueToday = pending.filter(t => t.dueDate === today);

  const shown = useMemo(() => {
    return tasks
      .filter(t => (filter === "pending" ? !t.done : filter === "done" ? t.done : true))
      .sort((a, b) => (a.done !== b.done ? (a.done ? 1 : -1) : a.dueDate.localeCompare(b.dueDate)));
  }, [tasks, filter]);

  const overdue = shown.filter(t => !t.done && t.dueDate < today);
  const todays = shown.filter(t => !t.done && t.dueDate === today);
  const upcoming = shown.filter(t => !t.done && t.dueDate > today);
  const done = shown.filter(t => t.done);

  const remove = async (t: TaskDto) => {
    try { await deleteTask(t.id); } catch (err) { toast.error(errorMessage(err, "Couldn't delete that activity.")); }
  };

  const row = (t: TaskDto) => (
    <TaskRow key={t.id} t={t} section={t.sectionId ? sectionMap.get(t.sectionId) : undefined} today={today}
      onToggle={() => void toggleTask(t.id)} onDelete={() => void remove(t)} />
  );

  return (
    <div className="p-4 md:p-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="text-xl text-[#ddefd4]">Farm Activities</h2>
          <p className="text-sm text-[#6a8f5e] mt-0.5">
            {pending.length} pending · est. {fmtMoney(pending.reduce((s, t) => s + t.estimatedCost, 0))} cost
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded overflow-hidden border border-[rgba(122,182,72,0.18)]" role="group" aria-label="Filter activities">
            {(["all", "pending", "done"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
                className={`px-3 py-1.5 text-[11px] capitalize transition-colors ${filter === f ? "bg-[#7ab648] text-[#0a1809]" : "bg-[#152a12] text-[#6a8f5e] hover:bg-[#1e3818]"}`}>{f}</button>
            ))}
          </div>
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-2 px-3 py-2 rounded bg-[#7ab648] text-[#0a1809] text-sm font-medium hover:bg-[#9ed460] transition-colors">
            <Plus size={14} />Add Task
          </button>
        </div>
      </div>

      {dueToday.length > 0 && filter !== "done" && (
        <div className="mb-5 p-3 rounded-lg bg-[#1f1a0a] border border-[rgba(212,168,67,0.25)] flex items-center gap-2">
          <AlertTriangle size={14} className="text-[#d4a843] flex-shrink-0" />
          <span className="text-sm text-[#d4a843]">{dueToday.length} task{dueToday.length !== 1 ? "s" : ""} due today</span>
        </div>
      )}

      <div className="max-w-3xl">
        {filter !== "done" && (
          <>
            <Group label="Overdue" color="#e8604a" count={overdue.length}>{overdue.map(row)}</Group>
            <Group label="Due Today" color="#e0a020" count={todays.length}>{todays.map(row)}</Group>
            <Group label="Upcoming" color="#7ab648" count={upcoming.length}>{upcoming.map(row)}</Group>
          </>
        )}
        {filter !== "pending" && <Group label="Completed" color="#6a8f5e" count={done.length}>{done.map(row)}</Group>}
        {shown.length === 0 && (
          <div className="text-center py-16 text-[#6a8f5e]">
            <CheckSquare2 size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">{tasks.length === 0 ? "No activities yet — add your first task." : "No activities match this filter."}</p>
          </div>
        )}
      </div>

      {adding && (
        <TaskModal sections={sections} today={today} onClose={() => setAdding(false)}
          onSave={async input => { await addTask(input); setAdding(false); toast.success("Activity added"); }} />
      )}
    </div>
  );
}
