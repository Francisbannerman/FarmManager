import { useState } from "react";
import type { SectionDto, SectionInput, SectionType } from "../api/types";
import { errorMessage } from "../api/client";
import { PRESET_COLORS, SECTION_TYPES, TYPE_KEYS } from "../format";
import { Field, Modal, inputCls } from "../ui";

interface Props {
  section: SectionDto | null; // null → create
  onSave: (input: SectionInput) => Promise<void>;
  onClose: () => void;
}

export function SectionModal({ section, onSave, onClose }: Props) {
  const [name, setName] = useState(section?.name ?? "");
  const [type, setType] = useState<SectionType>(section?.type ?? "garden");
  const [color, setColor] = useState(section?.color ?? SECTION_TYPES.garden.color);
  const [cropDetails, setCropDetails] = useState(section?.cropDetails ?? "");
  const [plantDate, setPlantDate] = useState(section?.plantDate ?? "");
  const [harvestDate, setHarvestDate] = useState(section?.harvestDate ?? "");
  const [waterSchedule, setWaterSchedule] = useState(section?.waterSchedule ?? "");
  const [notes, setNotes] = useState(section?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(), type, color,
        cropDetails: cropDetails.trim() || null,
        plantDate: plantDate || null,
        harvestDate: harvestDate.trim() || null,
        waterSchedule: waterSchedule.trim() || null,
        notes: notes.trim() || null,
      });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={section ? "Edit Section" : "New Section"} onClose={onClose} onSubmit={submit}
      busy={busy} error={error} disabled={!name.trim()}>
      <Field label="Section Name" htmlFor="sec-name">
        <input id="sec-name" className={inputCls} placeholder="e.g. South Tomatoes" value={name} maxLength={120}
          onChange={e => setName(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type" htmlFor="sec-type">
          <select id="sec-type" className={inputCls} value={type}
            onChange={e => {
              const t = e.target.value as SectionType;
              setType(t);
              setColor(SECTION_TYPES[t].color);
            }}>
            {TYPE_KEYS.map(k => <option key={k} value={k}>{SECTION_TYPES[k].icon} {SECTION_TYPES[k].label}</option>)}
          </select>
        </Field>
        <Field label="Color">
          <div className="flex flex-wrap gap-1.5 mt-1">
            {PRESET_COLORS.map(c => (
              <button type="button" key={c} onClick={() => setColor(c)} aria-label={`Color ${c}`} aria-pressed={color === c}
                className="w-5 h-5 rounded transition-transform hover:scale-110 flex-shrink-0"
                style={{ backgroundColor: c, outline: color === c ? "2px solid #ddefd4" : "none", outlineOffset: 1 }} />
            ))}
          </div>
        </Field>
      </div>
      <Field label="Crop / Use Details" htmlFor="sec-crop">
        <input id="sec-crop" className={inputCls} placeholder="Variety, spacing, intended use…" value={cropDetails} maxLength={500}
          onChange={e => setCropDetails(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Plant Date" htmlFor="sec-plant">
          <input id="sec-plant" type="date" className={inputCls} value={plantDate} onChange={e => setPlantDate(e.target.value)} />
        </Field>
        <Field label="Harvest / Review" htmlFor="sec-harvest">
          <input id="sec-harvest" className={inputCls} placeholder="Date or “Continuous”" value={harvestDate} maxLength={100}
            onChange={e => setHarvestDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Water Schedule" htmlFor="sec-water">
        <input id="sec-water" className={inputCls} placeholder="e.g. Daily drip, twice weekly" value={waterSchedule} maxLength={200}
          onChange={e => setWaterSchedule(e.target.value)} />
      </Field>
      <Field label="Notes" htmlFor="sec-notes">
        <textarea id="sec-notes" className={inputCls + " resize-none h-16"} placeholder="Soil type, spacing notes, risks…" value={notes} maxLength={2000}
          onChange={e => setNotes(e.target.value)} />
      </Field>
    </Modal>
  );
}
