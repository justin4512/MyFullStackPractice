import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Frame sequence and loop video live in public/ and are served as-is.
    target: 'es2020',
  },
});
