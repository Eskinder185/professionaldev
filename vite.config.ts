import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configure the base path so that assets and routes resolve correctly when
// deploying to a subfolder (e.g. GitHub Pages). Here the project is
// hosted at /professionaldev/ under the user's GitHub Pages site.
export default defineConfig({
  base: '/professionaldev/',
  plugins: [react()],
})
