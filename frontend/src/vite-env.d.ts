/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin. Default '' = same origin (Vite proxies /api in dev). */
  readonly VITE_API_BASE?: string;
}
