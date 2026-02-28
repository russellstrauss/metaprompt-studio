import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  // Use relative paths so the built app can be served from any subdirectory
  base: './',
  plugins: [vue()],
})
