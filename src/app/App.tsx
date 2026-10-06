import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { AuthPage } from "./auth/AuthPage";
import { FarmSetup } from "./FarmSetup";
import { FarmDashboard } from "./dashboard/FarmDashboard";
import { ToastProvider } from "./Toasts";
import { farmsApi } from "./api/endpoints";
import { errorMessage } from "./api/client";
import { API_CONFIGURED } from "./config";
import { Spinner } from "./ui";
import type { Farm } from "./api/types";

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-[#081508] p-6 text-center">{children}</div>;
}

/** Signed in: find the user's farm (or walk them through creating the first one). */
function Authenticated() {
  const { user, logout } = useAuth();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    farmsApi.list()
      .then(farms => {
        if (cancelled) return;
        if (farms.length > 0) setFarm(farms[0]);
        else setNeedsSetup(true);
      })
      .catch(err => { if (!cancelled) setError(errorMessage(err, "Couldn't load your farm.")); });
    return () => { cancelled = true; };
  }, [attempt]);

  if (error) {
    return (
      <Centered>
        <div className="max-w-sm">
          <h1 className="text-lg text-[#ddefd4] mb-2">Couldn't load your farm</h1>
          <p className="text-sm text-[#6a8f5e] mb-5">{error}</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => setAttempt(a => a + 1)} className="px-4 py-2 rounded bg-[#7ab648] text-[#0a1809] text-sm font-medium hover:bg-[#9ed460] transition-colors">Try again</button>
            <button onClick={() => void logout()} className="px-4 py-2 rounded text-sm text-[#6a8f5e] hover:text-[#ddefd4] transition-colors">Sign out</button>
          </div>
        </div>
      </Centered>
    );
  }

  if (farm) return <FarmDashboard key={farm.id} initialFarm={farm} />;

  if (needsSetup) {
    return <FarmSetup userName={user?.fullName ?? ""} onCreated={created => { setFarm(created); setNeedsSetup(false); }} onLogout={() => void logout()} />;
  }

  return <Centered><div className="flex items-center gap-3 text-[#6a8f5e]"><Spinner size={20} /><span className="text-sm">Loading…</span></div></Centered>;
}

function Gate() {
  const { user } = useAuth();
  if (!API_CONFIGURED) {
    return (
      <Centered>
        <div className="max-w-md">
          <h1 className="text-lg text-[#ddefd4] mb-2">Configuration missing</h1>
          <p className="text-sm text-[#6a8f5e] leading-relaxed">
            This build doesn't know where the Farm Manager API is. Set <code className="font-mono text-[#b8d4ac]">VITE_API_URL</code> to the API's address and rebuild.
          </p>
        </div>
      </Centered>
    );
  }
  // Keyed by user so signing out and in as someone else never shows the previous user's farm.
  return user ? <Authenticated key={user.id} /> : <AuthPage />;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ToastProvider>
  );
}
