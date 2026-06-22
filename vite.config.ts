import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/elevation': {
        target: 'https://api.opentopodata.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/elevation/, '/v1/srtm30m')
      }
    }
  }
})
