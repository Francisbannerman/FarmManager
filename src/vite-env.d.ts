/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Farm Manager API, e.g. https://api.example.com (no trailing slash). */
  readonly VITE_API_URL?: string;
  /** Currency label shown beside amounts (default "KES"). */
  readonly VITE_CURRENCY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
