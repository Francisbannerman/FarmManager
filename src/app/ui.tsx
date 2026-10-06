import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";

export const inputCls =
  "w-full bg-[#1a2d16] border border-[rgba(122,182,72,0.2)] rounded px-3 py-2 text-sm text-[#ddefd4] placeholder-[#4a6a40] focus:outline-none focus:border-[rgba(122,182,72,0.5)] disabled:opacity-50";
export const labelCls = "block text-[10px] font-mono text-[#6a8f5e] uppercase tracking-widest mb-1";
export const primaryBtn =
  "flex items-center justify-center gap-2 px-3 py-2 rounded bg-[#7ab648] text-[#0a1809] text-sm font-medium hover:bg-[#9ed460] transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export function Spinner({ size = 16 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin" aria-hidden="true" />;
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className={labelCls} htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <p className="text-[10px] text-[#4a6a40] mt-1">{hint}</p>}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div role="alert" className="px-3 py-2 rounded bg-[#2a110c] border border-[rgba(217,72,50,0.35)] text-xs text-[#f0a090] leading-relaxed">
      {message}
    </div>
  );
}

interface ModalProps {
  title: string;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  submitLabel?: string;
  busy?: boolean;
  error?: string | null;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}

/**
 * Accessible modal form. Defined at module level on purpose: a component that
 * is re-declared inside another component's render gets a new identity each
 * time, which remounts its children and steals focus from inputs mid-typing.
 */
export function Modal({ title, onClose, onSubmit, submitLabel = "Save", busy, error, disabled, danger, children }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>("input, select, textarea");
    first?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!busy && !disabled) void onSubmit();
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4"
      onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="bg-[#152a12] border border-[rgba(122,182,72,0.2)] rounded-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(122,182,72,0.1)] flex-shrink-0">
          <h3 id={titleId} className="text-[#ddefd4]">{title}</h3>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close"
            className="text-[#4a6a40] hover:text-[#ddefd4] transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="flex flex-col min-h-0 flex-1">
          <div className="p-5 flex flex-col gap-4 overflow-y-auto flex-1">
            {children}
            {error && <ErrorNote message={error} />}
          </div>
          <div className="flex justify-end gap-2 px-5 pb-5 flex-shrink-0">
            <button type="button" onClick={onClose} disabled={busy}
              className="px-4 py-2 text-sm text-[#6a8f5e] hover:text-[#ddefd4] transition-colors">Cancel</button>
            <button type="submit" disabled={busy || disabled}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                danger ? "bg-[#d94832] text-white hover:bg-[#e8604a]" : "bg-[#7ab648] text-[#0a1809] hover:bg-[#9ed460]"
              }`}>
              {busy && <Spinner size={14} />}{submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Small confirmation dialog for destructive actions. */
export function ConfirmDialog({ title, message, confirmLabel = "Delete", busy, error, onConfirm, onClose }: {
  title: string; message: ReactNode; confirmLabel?: string; busy?: boolean; error?: string | null;
  onConfirm: () => void | Promise<void>; onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose} onSubmit={onConfirm} submitLabel={confirmLabel} busy={busy} error={error} danger>
      <p className="text-sm text-[#b8d4ac] leading-relaxed">{message}</p>
    </Modal>
  );
}
