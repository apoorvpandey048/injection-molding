/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_3D?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
