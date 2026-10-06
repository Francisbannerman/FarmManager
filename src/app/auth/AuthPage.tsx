import { useState, type FormEvent } from "react";
import { Leaf } from "lucide-react";
import { useAuth } from "./AuthContext";
import { errorMessage } from "../api/client";
import { ErrorNote, Field, Spinner, inputCls, primaryBtn } from "../ui";

type Mode = "login" | "register";

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegister = mode === "register";

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (isRegister && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setBusy(true);
    try {
      if (isRegister) await register(email.trim(), fullName.trim(), password);
      else await login(email.trim(), password);
      // The session subscription swaps this screen out — nothing else to do.
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#081508] p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-7">
          <div className="w-12 h-12 rounded-xl bg-[#7ab648] flex items-center justify-center mb-3">
            <Leaf size={22} className="text-[#0a1809]" />
          </div>
          <h1 className="text-xl text-[#ddefd4]">Farm Manager</h1>
          <p className="text-sm text-[#6a8f5e] mt-1">
            {isRegister ? "Create your account to start mapping your farm" : "Sign in to your farm"}
          </p>
        </div>

        <form onSubmit={submit} className="rounded-xl border border-[rgba(122,182,72,0.2)] bg-[#152a12] p-5 flex flex-col gap-4">
          {isRegister && (
            <Field label="Full name" htmlFor="fullName">
              <input id="fullName" className={inputCls} value={fullName} required maxLength={150} autoComplete="name"
                onChange={e => setFullName(e.target.value)} />
            </Field>
          )}
          <Field label="Email" htmlFor="email">
            <input id="email" type="email" className={inputCls} value={email} required maxLength={256} autoComplete="email"
              onChange={e => setEmail(e.target.value)} />
          </Field>
          <Field label="Password" htmlFor="password" hint={isRegister ? "At least 8 characters." : undefined}>
            <input id="password" type="password" className={inputCls} value={password} required maxLength={128}
              autoComplete={isRegister ? "new-password" : "current-password"}
              onChange={e => setPassword(e.target.value)} />
          </Field>

          {error && <ErrorNote message={error} />}

          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy && <Spinner size={14} />}{isRegister ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-[#6a8f5e] mt-4">
          {isRegister ? "Already have an account?" : "New here?"}{" "}
          <button type="button" onClick={() => switchMode(isRegister ? "login" : "register")}
            className="text-[#7ab648] hover:text-[#9ed460] underline underline-offset-2">
            {isRegister ? "Sign in" : "Create an account"}
          </button>
        </p>
      </div>
    </div>
  );
}
