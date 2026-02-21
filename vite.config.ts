import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import vike from 'vike/plugin'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    vike(),
  ],
  server: {
    port: 3000,
  },
})
