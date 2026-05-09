import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Allows access from all hosts
    port: 5173, // You can change the default port if needed
    allowedHosts: true, // Specifically allow all hosts for newer vite versions
  },
})
