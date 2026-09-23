import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/',

  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, 'index.html'),
        maptap: resolve(__dirname, 'MaptapClone/index.html'),
        about: resolve(__dirname, 'about/index.html'),
        projects: resolve(__dirname, 'projects/index.html'),
        misc: resolve(__dirname, 'misc/index.html')
      },
    },
  },
});
