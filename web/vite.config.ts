import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Read .env from the repo root, shared with Netlify functions and Trigger.dev.
  envDir: '..',
  // Lets `npm run dev:web` call Netlify functions when `netlify dev` runs on 8888.
  // Fixed port so Symph never collides with other local Vite apps (e.g. Skipper on 5173).
  server: { port: 5190, strictPort: true, proxy: { '/api': 'http://localhost:8888' } },
})
