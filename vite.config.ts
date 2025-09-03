import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // repo name between slashes:
  base: '/professionaldev/',
  plugins: [react()],
})
