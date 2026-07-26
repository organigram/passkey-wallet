import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'app-dist'
  },
  server: {
    host: '127.0.0.1',
    port: 3003
  },
  preview: {
    host: '127.0.0.1',
    port: 3003
  }
})
