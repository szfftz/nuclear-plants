# 台灣四座核電廠，你知道在哪裡嗎？

台灣地圖固定在畫面中間，依序點出核一、核二、核三、核四的位置，按「確定」後揭曉實際位置和各差幾公里，最後可以看所有人點的位置。

參考 [szfftz/political-spectrum](https://github.com/szfftz/political-spectrum) 的流程：作答 → 上傳 Supabase → 結果頁看大家的分布。

## 開發

```bash
npm install
npm run serve      # http://localhost:8080（npm run dev 也可以）
npm run build      # 輸出到 dist/
npm run deploy     # build 後推到 gh-pages 分支（GitHub Pages）
```

## 資料儲存（Supabase）

資料表 `data` 的設計參考 political-spectrum，每人每座核電廠一列：

| 欄位 | 說明 |
| --- | --- |
| `cookie_id` | 瀏覽器的匿名 id（存在 cookie） |
| `name` | 核一／核二／核三／核四 |
| `lat`、`lon` | 點的經緯度 |
| `created_at`、`update_at` | 由伺服器寫入的時間 |

**每人只能上傳一次。** 第一次按「確定」時寫入四列；之後再玩，結果只存在 localStorage。資料庫用 `unique (cookie_id, name)` 擋重複，RLS 只開放匿名讀取和新增，不能修改或刪除。結構見 `supabase/schema.sql`。

連線設定放在 `.env`（範例見 `.env.example`），沒填會用 `src/config/api.js` 裡的預設專案。publishable key 本來就是公開給前端用的。

## 檔案

| 路徑 | 說明 |
| --- | --- |
| `src/config/plants.js` | 四座核電廠的實際座標、距離計算 |
| `src/config/api.js` | 上傳一次到 Supabase、之後存 localStorage |
| `src/components/TaiwanMap.vue` | 固定的台灣地圖（d3 Mercator），用 slot 疊圖層 |
| `src/views/HomeView.vue` | 點四個點、拖曳微調、確定後揭曉差距 |
| `src/views/ResultView.vue` | 所有人放的位置、平均／中位數誤差，可依核電廠篩選 |
| `src/components/NuclearMarker.vue` | 實際位置的圓形核能圖示（SVG 三葉扇形） |
| `public/data/taiwan.json` | 台灣外框（不含金門、馬祖），由 `npm run build:map` 從 [taiwan-atlas](https://github.com/dkaoster/taiwan-atlas) 產生 |
