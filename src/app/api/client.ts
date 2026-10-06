import { API_URL } from "../config";
import type { AuthResponse, AuthTokens, CurrentUser } from "./types";

// ─── Session storage ─────────────────────────────────────────────────────────
// The session (user + token pair) lives in localStorage so a refresh or a new
// tab keeps you signed in. Reads and writes are wrapped because storage can be
// unavailable (private mode, blocked cookies) — the app then simply behaves as
// "signed out" instead of crashing.

const STORAGE_KEY = "farmmanager.session.v1";

export interface Session {
  user: CurrentUser;
  tokens: AuthTokens;
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    return parsed?.tokens?.accessToken && parsed?.tokens?.refreshToken ? parsed : null;
  } catch {
    return null;
  }
}

function persistSession(next: Session | null) {
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable — keep the in-memory session only */
  }
}

let session: Session | null = loadSession();
const listeners = new Set<(s: Session | null) => void>();

function notify() {
  listeners.forEach(fn => fn(session));
}

export function getSession(): Session | null {
  return session;
}

export function setSession(next: Session | null) {
  session = next;
  persistSession(next);
  notify();
}

export function subscribeSession(fn: (s: Session | null) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// Keep several open tabs in step: signing out (or refreshing tokens) in one tab
// is reflected in the others.
if (typeof window !== "undefined") {
  window.addEventListener("storage", e => {
    if (e.key === STORAGE_KEY) {
      session = loadSession();
      notify();
    }
  });
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string[]>;

  constructor(status: number, message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  return err instanceof ApiError ? err.message : fallback;
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: { title?: string; detail?: string; errors?: Record<string, string[] | string> } | null = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON error body */
  }

  const fieldErrors: Record<string, string[]> = {};
  if (body?.errors && typeof body.errors === "object") {
    for (const [field, msgs] of Object.entries(body.errors)) {
      fieldErrors[field] = Array.isArray(msgs) ? msgs : [String(msgs)];
    }
  }

  const firstFieldError = Object.values(fieldErrors)[0]?.[0];

  let message: string;
  if (res.status === 429) message = "Too many requests. Please wait a moment and try again.";
  else if (firstFieldError) message = firstFieldError;
  else if (res.status >= 500) message = "The server hit a problem. Please try again in a moment.";
  else message = body?.detail || body?.title || `Request failed (${res.status}).`;

  return new ApiError(res.status, message, fieldErrors);
}

// ─── Transport ───────────────────────────────────────────────────────────────

const NETWORK_MESSAGE = "Can't reach the server. Check your connection and try again.";

async function send(path: string, method: string, body: unknown, token: string | null, signal?: AbortSignal): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    return await fetch(`${API_URL}/api/v1${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, NETWORK_MESSAGE);
  }
}

// Refresh tokens are single-use (the server rotates them). If two requests hit
// a 401 at once and both tried to refresh, the second would present an already
// used token — which the server treats as theft. So refreshes are single-flight.
let refreshing: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  const refreshToken = session?.tokens.refreshToken;
  if (!refreshToken) throw new ApiError(401, "Your session has expired. Please sign in again.");

  const res = await send("/auth/refresh", "POST", { refreshToken }, null);

  if (!res.ok) {
    // Another tab may have rotated the tokens a moment ago — adopt its result.
    const stored = loadSession();
    if (stored && stored.tokens.refreshToken !== refreshToken) {
      session = stored;
      notify();
      return stored.tokens.accessToken;
    }
    setSession(null);
    throw new ApiError(401, "Your session has expired. Please sign in again.");
  }

  const data = (await res.json()) as AuthResponse;
  setSession({ user: { id: data.userId, email: data.email, fullName: data.fullName }, tokens: data.tokens });
  return data.tokens.accessToken;
}

function refreshAccessToken(failedToken: string | null): Promise<string> {
  // A different request or tab may already have obtained a newer token.
  const current = session?.tokens.accessToken;
  if (current && current !== failedToken) return Promise.resolve(current);

  if (!refreshing) {
    refreshing = doRefresh().finally(() => { refreshing = null; });
  }
  return refreshing;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Set false for the public auth endpoints. */
  auth?: boolean;
  signal?: AbortSignal;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, signal } = options;

  const usedToken = auth ? session?.tokens.accessToken ?? null : null;
  let res = await send(path, method, body, usedToken, signal);

  if (res.status === 401 && auth && session) {
    const fresh = await refreshAccessToken(usedToken);
    res = await send(path, method, body, fresh, signal);
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

function adopt(data: AuthResponse) {
  setSession({ user: { id: data.userId, email: data.email, fullName: data.fullName }, tokens: data.tokens });
}

export async function login(email: string, password: string): Promise<void> {
  adopt(await api<AuthResponse>("/auth/login", { method: "POST", body: { email, password }, auth: false }));
}

export async function register(email: string, fullName: string, password: string): Promise<void> {
  adopt(await api<AuthResponse>("/auth/register", { method: "POST", body: { email, fullName, password }, auth: false }));
}

export async function logout(): Promise<void> {
  const refreshToken = session?.tokens.refreshToken;
  // Clear locally first so the UI signs out instantly; revoking server-side is best effort.
  setSession(null);
  if (!refreshToken) return;
  try {
    await api<void>("/auth/logout", { method: "POST", body: { refreshToken }, auth: false });
  } catch {
    /* offline or already revoked — the local session is gone either way */
  }
}
