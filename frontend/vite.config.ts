import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // fixed port so the backend CORS allowlist (backend/main.py) stays valid;
  // strictPort so it fails loudly instead of drifting to a port CORS rejects
  server: { port: 5180, strictPort: true },
})
