import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/',

  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, 'index.html'),
        maptap: resolve(__dirname, 'MaptapClone/index.html'),
      },
    },
  },
});