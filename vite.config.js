import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// base 用相對路徑，部署到 GitHub Pages 子路徑或 Netlify 根目錄都能用
export default defineConfig({
  base: './',
  // 沿用 NEXT_PUBLIC_ 開頭的 Supabase 環境變數名稱
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  plugins: [vue()],
});
