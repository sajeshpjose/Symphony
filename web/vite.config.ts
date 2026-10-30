import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Lets `npm run dev:web` call Netlify functions when `netlify dev` runs on 8888.
  server: { proxy: { '/api': 'http://localhost:8888' } },
})
