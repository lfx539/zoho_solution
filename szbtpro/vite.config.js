import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        product: resolve(__dirname, 'indexProduct.html'),
        po: resolve(__dirname, 'indexPO.html'),
        updatePO: resolve(__dirname, 'indexUpdatePO.html'),
        createCase: resolve(__dirname, 'indexCreateCase.html'),
        createCaseFromDeal: resolve(__dirname, 'indexCreateCaseFromDeal.html'),
      },
    },
  },
})
