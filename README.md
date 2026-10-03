# 核電廠在哪裡？

台灣地圖固定在畫面中間，依序點出核一、核二、核三、核四的位置，按「確定」後揭曉實際位置和各差幾公里，最後可以看所有人點的位置。

參考 [szfftz/political-spectrum](https://github.com/szfftz/political-spectrum) 的流程：作答 → 上傳 Supabase → 結果頁看大家的分布。

## 開發

```bash
npm install
npm run serve      # http://localhost:8080（npm run dev 也可以）
npm run build      # 輸出到 dist/
```

## 資料儲存

- 沒有設定 Supabase 時是「本機模式」，資料存在瀏覽器 localStorage，只看得到自己的。
- 要收集所有人的資料：
  1. 在 Supabase 的 SQL Editor 執行 `supabase/schema.sql`（建 `submissions` 表和 RLS：匿名只能新增、讀取）
  2. 複製 `.env.example` 成 `.env`，填入 Project URL 和 anon key
  3. 部署到 GitHub Pages 時，在 repo 的 Actions Variables 設定 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`

每個瀏覽器有一個匿名 id，結果頁每人只算最新一次作答。

## 檔案

| 路徑 | 說明 |
| --- | --- |
| `src/config/plants.js` | 四座核電廠的實際座標、距離計算 |
| `src/config/api.js` | 存取 Supabase / localStorage |
| `src/components/TaiwanMap.vue` | 固定的台灣地圖（d3 Mercator），用 slot 疊圖層 |
| `src/views/HomeView.vue` | 點四個點、拖曳微調、確定後揭曉差距 |
| `src/views/ResultView.vue` | 所有人的點、平均位置、平均／中位數誤差 |
| `public/data/taiwan.json` | 台灣外框（不含金門、馬祖），由 `npm run build:map` 從 [taiwan-atlas](https://github.com/dkaoster/taiwan-atlas) 產生 |
