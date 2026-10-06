import { useState, type FormEvent } from "react";
import { Leaf } from "lucide-react";
import { farmsApi } from "./api/endpoints";
import { errorMessage } from "./api/client";
import type { Farm } from "./api/types";
import { ErrorNote, Field, Spinner, inputCls, primaryBtn } from "./ui";
import { UI_MAX_FARM_METERS, UI_MIN_FARM_METERS, metersToAcres } from "./format";

const MIN = UI_MIN_FARM_METERS;
const MAX = UI_MAX_FARM_METERS;

export function FarmSetup({ userName, onCreated, onLogout }: { userName: string; onCreated: (farm: Farm) => void; onLogout: () => void }) {
  const [name, setName] = useState("");
  const [width, setWidth] = useState(200);
  const [height, setHeight] = useState(200);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length > 0 && [width, height].every(v => Number.isInteger(v) && v >= MIN && v <= MAX);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      onCreated(await farmsApi.create({ name: name.trim(), widthMeters: width, heightMeters: height }));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#081508] p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-7 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#7ab648] flex items-center justify-center mb-3">
            <Leaf size={22} className="text-[#0a1809]" />
          </div>
          <h1 className="text-xl text-[#ddefd4]">Welcome, {userName.split(" ")[0] || "farmer"}</h1>
          <p className="text-sm text-[#6a8f5e] mt-1">Set up your farm. You can rename or resize it any time.</p>
        </div>

        <form onSubmit={submit} className="rounded-xl border border-[rgba(122,182,72,0.2)] bg-[#152a12] p-5 flex flex-col gap-4">
          <Field label="Farm name" htmlFor="farmName">
            <input id="farmName" className={inputCls} value={name} required maxLength={120} placeholder="e.g. Sunrise Farm"
              onChange={e => setName(e.target.value)} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Width (m)" htmlFor="farmW">
              <input id="farmW" type="number" className={inputCls} min={MIN} max={MAX} step={5} value={width}
                onChange={e => setWidth(Number(e.target.value))} />
            </Field>
            <Field label="Height (m)" htmlFor="farmH">
              <input id="farmH" type="number" className={inputCls} min={MIN} max={MAX} step={5} value={height}
                onChange={e => setHeight(Number(e.target.value))} />
            </Field>
          </div>
          <p className="text-xs text-[#6a8f5e]">
            {valid
              ? <>That's about <span className="font-mono text-[#b8d4ac]">{metersToAcres(width, height).toFixed(1)} acres</span>.</>
              : <>Each side must be between {MIN} m and {MAX.toLocaleString()} m.</>}
          </p>

          {error && <ErrorNote message={error} />}

          <button type="submit" disabled={!valid || busy} className={primaryBtn}>
            {busy && <Spinner size={14} />}Create farm
          </button>
        </form>

        <p className="text-center text-sm text-[#4a6a40] mt-4">
          <button type="button" onClick={onLogout} className="hover:text-[#6a8f5e] underline underline-offset-2">Sign out</button>
        </p>
      </div>
    </div>
  );
}
