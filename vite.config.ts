import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Set via `vite build --base /DiskMate/` in CI; defaults to '/' locally.
export default defineConfig({ plugins: [vue()] })
