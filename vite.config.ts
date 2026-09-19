import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  /*
   * ⚠️ `base` 只对 **Vite 亲手处理的引用**生效：`index.html` 里的 `href`、CSS 里的 `url()`、
   * 打包产物的地址，构建时都会自动带上它。**TS 字符串里手写的路径不会** ——
   * 主题自带的背景图（`/bg/8-evercold.webp`）、物品库（`data/item-db.json`）都属于后者，
   * 运行时拼这类地址一律走 `src/core/asset-url.ts` 的 `assetUrl()`，不要手写 BASE_URL。
   */
  base: '/ffxiv-dash/',
  server: {
    watch: {
      ignored: ['**/.*.tmpdir/**', '**/*.tmpdir/**', '**/.*.tmpdir'],
    },
  },
})
