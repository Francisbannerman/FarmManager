import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { Farm } from "../api/types";
import { errorMessage } from "../api/client";
import { UI_MAX_FARM_METERS, UI_MIN_FARM_METERS, metersToAcres } from "../format";
import { Field, Modal, inputCls } from "../ui";

const MIN = UI_MIN_FARM_METERS;
const MAX = UI_MAX_FARM_METERS;
const STEP = 50;

function Stepper({ label, id, value, onChange }: { label: string; id: string; value: number; onChange: (v: number) => void }) {
  const btn = "w-8 h-8 rounded bg-[#1a2d16] border border-[rgba(122,182,72,0.2)] text-[#6a8f5e] hover:text-[#ddefd4] hover:border-[rgba(122,182,72,0.4)] flex items-center justify-center transition-colors flex-shrink-0";
  return (
    <Field label={label} htmlFor={id}>
      <div className="flex items-center gap-1.5">
        <button type="button" className={btn} aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(MIN, value - STEP))}>−</button>
        <input id={id} type="number" className={inputCls + " text-center"} value={value} min={MIN} max={MAX}
          onChange={e => onChange(Number(e.target.value))} />
        <button type="button" className={btn} aria-label={`Increase ${label}`} onClick={() => onChange(Math.min(MAX, value + STEP))}>+</button>
      </div>
    </Field>
  );
}

interface Props {
  farm: Farm;
  onSave: (name: string, widthMeters: number, heightMeters: number) => Promise<void>;
  onClose: () => void;
}

export function FarmSettingsModal({ farm, onSave, onClose }: Props) {
  const [name, setName] = useState(farm.name);
  const [width, setWidth] = useState(farm.widthMeters);
  const [height, setHeight] = useState(farm.heightMeters);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sizeValid = [width, height].every(v => Number.isInteger(v) && v >= MIN && v <= MAX);
  const changed = name.trim() !== farm.name || width !== farm.widthMeters || height !== farm.heightMeters;
  const shrinks = width < farm.widthMeters || height < farm.heightMeters;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave(name.trim(), width, height);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="Farm Settings" onClose={onClose} onSubmit={submit} busy={busy} error={error}
      disabled={!name.trim() || !sizeValid || !changed}>
      <Field label="Farm Name" htmlFor="farm-name">
        <input id="farm-name" className={inputCls} value={name} maxLength={120} onChange={e => setName(e.target.value)} />
      </Field>
      <p className="text-xs text-[#6a8f5e] leading-relaxed">
        Current size <span className="font-mono text-[#b8d4ac]">{farm.widthMeters}m × {farm.heightMeters}m</span> · {metersToAcres(farm.widthMeters, farm.heightMeters).toFixed(1)} ac
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Stepper label="Width (m)" id="farm-w" value={width} onChange={setWidth} />
        <Stepper label="Height (m)" id="farm-h" value={height} onChange={setHeight} />
      </div>
      <div className="flex items-center justify-between px-3 py-2 rounded bg-[#1a2d16] border border-[rgba(122,182,72,0.15)]">
        <span className="text-xs text-[#6a8f5e]">New size</span>
        <span className="text-xs font-mono text-[#ddefd4]">
          {sizeValid ? `${width}m × ${height}m · ${metersToAcres(width, height).toFixed(1)} ac` : `Each side ${MIN}–${MAX.toLocaleString()} m`}
        </span>
      </div>
      {shrinks && sizeValid && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded bg-[#1f1a0a] border border-[rgba(212,168,67,0.25)]">
          <AlertTriangle size={14} className="text-[#d4a843] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#d4a843] leading-relaxed">
            Shrinking the farm permanently clears any painted section that falls outside the new boundary. This can't be undone.
          </p>
        </div>
      )}
    </Modal>
  );
}
