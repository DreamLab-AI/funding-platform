/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_APP_NAME: string;
  // 'true' enables demo-data fallbacks (static showcase build only); off by default.
  readonly VITE_DEMO_MODE?: string;
  // Add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
