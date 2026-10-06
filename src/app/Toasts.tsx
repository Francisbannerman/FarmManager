import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

type Kind = "success" | "error";
interface Toast { id: number; kind: Kind; message: string }
interface ToastApi { success: (m: string) => void; error: (m: string) => void }

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), []);

  const push = useCallback((kind: Kind, message: string) => {
    const id = nextId.current++;
    setToasts(t => [...t.slice(-3), { id, kind, message }]);
    window.setTimeout(() => dismiss(id), kind === "error" ? 7000 : 3500);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    success: m => push("success", m),
    error: m => push("error", m),
  }), [push]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[min(22rem,calc(100vw-2rem))]" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} role={t.kind === "error" ? "alert" : "status"}
            className={`flex items-start gap-2.5 px-3.5 py-3 rounded-lg border shadow-lg text-sm ${
              t.kind === "error"
                ? "bg-[#2a110c] border-[rgba(217,72,50,0.45)] text-[#f0a090]"
                : "bg-[#12260f] border-[rgba(122,182,72,0.4)] text-[#ddefd4]"
            }`}>
            {t.kind === "error" ? <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" /> : <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-[#7ab648]" />}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="opacity-60 hover:opacity-100"><X size={13} /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
