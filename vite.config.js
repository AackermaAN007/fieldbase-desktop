import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: true, // fail fast if port is taken — prevents duplicate Vite on different port
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'qrcode'], // pre-bundle on first run, cached after
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
