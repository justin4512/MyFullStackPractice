import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './'：建置結果不綁定網址路徑，deploy.sh 以 repo 相對路徑上傳到 NAS 任何子目錄都能運作
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
