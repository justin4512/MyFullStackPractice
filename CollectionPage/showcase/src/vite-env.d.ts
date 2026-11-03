/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 作品頁的網址前綴，見 .env.development／.env.production */
  readonly VITE_WORKS_BASE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
