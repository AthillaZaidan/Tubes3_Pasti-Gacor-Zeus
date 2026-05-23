import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  build: {
    copyPublicDir: false,
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/content/content.ts'),
      output: {
        entryFileNames: 'content.js',
        inlineDynamicImports: true,
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
})
