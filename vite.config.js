import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// base 用相對路徑，部署到 GitHub Pages 子路徑或 Netlify 根目錄都能用
export default defineConfig({
  base: './',
  plugins: [vue()],
});
