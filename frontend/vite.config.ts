import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // fixed port so the backend CORS allowlist (backend/main.py) stays valid;
  // strictPort so it fails loudly instead of drifting to a port CORS rejects.
  // host 127.0.0.1 (IPv4 loopback) because Spotify's redirect URI must be
  // http://127.0.0.1:5180/ — localhost is rejected as insecure
  server: { port: 5180, strictPort: true, host: "127.0.0.1" },
})
