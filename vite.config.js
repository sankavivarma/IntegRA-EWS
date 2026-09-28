import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const backendUrl = process.env.PAIMANA_BACKEND_URL || 'http://127.0.0.1:8001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
})
