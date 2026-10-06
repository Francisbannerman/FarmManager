// Base URL of the Farm Manager API. In development it falls back to the
// default `dotnet run` address; a production build must be given VITE_API_URL
// at build time (see .env.example) or the app shows a configuration error
// instead of silently calling the wrong server.
const raw = import.meta.env.VITE_API_URL?.trim();

export const API_URL = (raw || (import.meta.env.DEV ? "http://localhost:5000" : "")).replace(/\/+$/, "");
export const API_CONFIGURED = API_URL.length > 0;

/** Currency label shown next to every amount. Display only — the API stores plain numbers. */
export const CURRENCY = import.meta.env.VITE_CURRENCY?.trim() || "KES";
