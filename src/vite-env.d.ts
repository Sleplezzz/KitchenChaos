/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PORTAL_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
