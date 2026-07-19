import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,      
    // The storage server (server/index.cjs, `npm run server`) holds project
    // data on disk. In dev, proxy /api/* there so the Vite dev server and
    // the storage server can run side by side on different ports.
    proxy: {
      '/api': { 
        target: 'http://localhost:4173', 
        changeOrigin: true 
      },
    },
  },
})