import { useEffect, useState } from "react";
import { CheckSquare2, Leaf, LogOut, Map as MapIcon, TrendingUp, type LucideIcon } from "lucide-react";
import type { Farm, SectionDto } from "../api/types";
import { errorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../Toasts";
import { ConfirmDialog, Spinner } from "../ui";
import { fmtAcres, fmtMoneyShort, todayLocal } from "../format";
import { useFarmData } from "./useFarmData";
import { MapTab } from "./MapTab";
import { SectionsTab } from "./SectionsTab";
import { ActivitiesTab } from "./ActivitiesTab";
import { FinanceTab } from "./FinanceTab";
import { SectionModal } from "./SectionModal";
import { FarmSettingsModal } from "./FarmSettingsModal";

type TabId = "map" | "sections" | "activities" | "finance";
type Modal =
  | { kind: "section"; section: SectionDto | null }
  | { kind: "deleteSection"; section: SectionDto }
  | { kind: "farmSettings" };

const NAV: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "map", label: "Farm Map", icon: MapIcon },
  { id: "sections", label: "Sections", icon: Leaf },
  { id: "activities", label: "Activities", icon: CheckSquare2 },
  { id: "finance", label: "Finance", icon: TrendingUp },
];

export function FarmDashboard({ initialFarm }: { initialFarm: Farm }) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const data = useFarmData(initialFarm);
  const { farm, sections, tasks, summary, dims, cellCounts } = data;

  const [tab, setTab] = useState<TabId>("map");
  const [modal, setModal] = useState<Modal | null>(null);
  const [selectedSecId, setSelectedSecId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const today = todayLocal();

  // Keep a valid brush selected: default to the first section, recover if the selected one is deleted.
  useEffect(() => {
    if (!sections.some(s => s.id === selectedSecId)) setSelectedSecId(sections[0]?.id ?? null);
  }, [sections, selectedSecId]);

  const closeModal = () => { setModal(null); setDeleteError(null); };

  const totalCells = dims.cols * dims.rows;
  const filled = Object.values(cellCounts).reduce((a, b) => a + b, 0);
  const pending = tasks.filter(t => !t.done);
  const dueToday = pending.filter(t => t.dueDate === today);

  const stats = [
    { label: "Farm size", value: `${fmtAcres(totalCells, dims.cellSize)} ac` },
    { label: "Mapped", value: `${fmtAcres(filled, dims.cellSize)} ac` },
    { label: "Sections", value: String(sections.length) },
    { label: "Pending tasks", value: String(pending.length), warn: pending.length > 5 },
    { label: "Due today", value: String(dueToday.length), warn: dueToday.length > 0 },
    { label: "Net profit", value: summary ? fmtMoneyShort(summary.netProfit) : "—", warn: !!summary && summary.netProfit < 0 },
  ];

  if (data.loading && sections.length === 0 && !data.loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#081508] text-[#6a8f5e] gap-3">
        <Spinner size={20} /><span className="text-sm">Loading your farm…</span>
      </div>
    );
  }

  if (data.loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#081508] p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg text-[#ddefd4] mb-2">Couldn't load your farm</h1>
          <p className="text-sm text-[#6a8f5e] mb-5">{data.loadError}</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => void data.reload()} className="px-4 py-2 rounded bg-[#7ab648] text-[#0a1809] text-sm font-medium hover:bg-[#9ed460] transition-colors">Try again</button>
            <button onClick={() => void logout()} className="px-4 py-2 rounded text-sm text-[#6a8f5e] hover:text-[#ddefd4] transition-colors">Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  const saveSection = async (existing: SectionDto | null, input: Parameters<typeof data.createSection>[0]) => {
    if (existing) {
      await data.updateSection(existing.id, input);
      toast.success("Section updated");
    } else {
      const created = await data.createSection(input);
      setSelectedSecId(created.id);
      toast.success("Section created");
    }
    closeModal();
  };

  const confirmDeleteSection = async (section: SectionDto) => {
    setDeleteBusy(true); setDeleteError(null);
    try {
      await data.deleteSection(section.id);
      toast.success(`Deleted ${section.name}`);
      closeModal();
    } catch (err) {
      setDeleteError(errorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  const saveFarm = async (name: string, w: number, h: number) => {
    const cleared = await data.updateFarm(name, w, h);
    toast.success(cleared > 0 ? `Farm updated — ${cleared} painted cell${cleared !== 1 ? "s" : ""} outside the new boundary were cleared` : "Farm updated");
    closeModal();
  };

  const activeNav = NAV.find(n => n.id === tab)!;

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-[#081508]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-52 flex-shrink-0 bg-[#0d1e0b] border-r border-[rgba(122,182,72,0.1)] flex-col">
        <button onClick={() => setModal({ kind: "farmSettings" })} title="Farm settings"
          className="px-4 py-4 border-b border-[rgba(122,182,72,0.08)] text-left hover:bg-[#12260f] transition-colors">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#7ab648] flex items-center justify-center flex-shrink-0"><Leaf size={15} className="text-[#0a1809]" /></div>
            <div className="min-w-0">
              <p className="text-sm text-[#ddefd4] truncate leading-tight">{farm.name}</p>
              <p className="text-[10px] font-mono text-[#6a8f5e]">{fmtAcres(totalCells, dims.cellSize)} ac · Settings</p>
            </div>
          </div>
        </button>
        <nav className="px-2 py-3 flex flex-col gap-0.5" aria-label="Main">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors w-full ${
                tab === id ? "bg-[#1e3818] text-[#7ab648]" : "text-[#8fb07e] hover:bg-[#152a12] hover:text-[#b8d4ac]"
              }`}>
              <Icon size={15} />{label}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-[rgba(122,182,72,0.08)] px-4 py-4">
          <p className="text-[10px] font-mono text-[#6a8f5e] uppercase tracking-widest mb-3">Quick Stats</p>
          {stats.map(({ label, value, warn }) => (
            <div key={label} className="flex items-center justify-between py-1">
              <span className="text-[11px] text-[#6a8f5e]">{label}</span>
              <span className={`text-[11px] font-mono ${warn ? "text-[#d4a843]" : "text-[#b8d4ac]"}`}>{value}</span>
            </div>
          ))}
        </div>
        <div className="px-4 pb-4 pt-2 border-t border-[rgba(122,182,72,0.08)]">
          <p className="text-[11px] text-[#b8d4ac] truncate" title={user?.email}>{user?.fullName}</p>
          <button onClick={() => void logout()} className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#6a8f5e] hover:text-[#ddefd4] transition-colors">
            <LogOut size={12} />Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden flex-shrink-0 bg-[#0d1e0b] border-b border-[rgba(122,182,72,0.1)]">
        <div className="flex items-center justify-between px-3 py-2">
          <button onClick={() => setModal({ kind: "farmSettings" })} className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#7ab648] flex items-center justify-center flex-shrink-0"><Leaf size={14} className="text-[#0a1809]" /></div>
            <span className="text-sm text-[#ddefd4] truncate">{farm.name}</span>
          </button>
          <button onClick={() => void logout()} aria-label="Sign out" className="p-2 text-[#6a8f5e] hover:text-[#ddefd4]"><LogOut size={15} /></button>
        </div>
        <nav className="flex px-2 pb-2 gap-1" aria-label="Main">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined}
              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded text-[10px] transition-colors ${
                tab === id ? "bg-[#1e3818] text-[#7ab648]" : "text-[#8fb07e]"
              }`}>
              <Icon size={15} />{label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        <div className="hidden md:flex flex-shrink-0 h-11 px-5 border-b border-[rgba(122,182,72,0.1)] bg-[#0d1e0b] items-center gap-2">
          <activeNav.icon size={15} className="text-[#7ab648]" />
          <span className="text-sm text-[#ddefd4]">{activeNav.label}</span>
          <span className="ml-auto text-[10px] font-mono text-[#6a8f5e]">
            {new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          {tab === "map" && (
            <MapTab data={data} selectedSecId={selectedSecId} onSelectSection={setSelectedSecId}
              onAddSection={() => setModal({ kind: "section", section: null })}
              onFarmSettings={() => setModal({ kind: "farmSettings" })} />
          )}
          {tab === "sections" && (
            <SectionsTab data={data} onAdd={() => setModal({ kind: "section", section: null })}
              onEdit={section => setModal({ kind: "section", section })}
              onDelete={section => { setDeleteError(null); setModal({ kind: "deleteSection", section }); }} />
          )}
          {tab === "activities" && <ActivitiesTab data={data} today={today} />}
          {tab === "finance" && <FinanceTab data={data} />}
        </div>
      </main>

      {modal?.kind === "section" && (
        <SectionModal section={modal.section} onClose={closeModal} onSave={input => saveSection(modal.section, input)} />
      )}
      {modal?.kind === "deleteSection" && (
        <ConfirmDialog title="Delete section?" busy={deleteBusy} error={deleteError} onClose={closeModal}
          onConfirm={() => confirmDeleteSection(modal.section)}
          message={<>This removes <span className="text-[#ddefd4]">{modal.section.name}</span> and clears its painted area from the map. Its activities and transactions stay, as farm-wide entries.</>} />
      )}
      {modal?.kind === "farmSettings" && <FarmSettingsModal farm={farm} onClose={closeModal} onSave={saveFarm} />}
    </div>
  );
}
