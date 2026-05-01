import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // Helpful for ngrok/dev tunnels where hostnames can change
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
  },
})
