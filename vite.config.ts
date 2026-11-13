import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from '@vant/auto-import-resolver'

// Set via `vite build --base /DiskMate/` in CI; defaults to '/' locally.
// Vant (mobile UI kit) components are auto-imported on use, with their styles.
export default defineConfig({
  plugins: [vue(), Components({ resolvers: [VantResolver()], dts: 'src/components.d.ts' })],
})
