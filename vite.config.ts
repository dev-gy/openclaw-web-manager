import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import vike from 'vike/plugin'
import vikeNode from 'vike-node/plugin'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    vike(),
    vikeNode('server/index.ts'),
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
    watch: {
      usePolling: true,
    },
  },
})
